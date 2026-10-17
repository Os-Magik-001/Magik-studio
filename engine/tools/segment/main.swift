// Person matte for a time range of a video: white = person, black = background.
// Usage: segment <input-video> <start-seconds> <duration-seconds> <fps> <out.mov>
import AVFoundation
import Accelerate
import CoreImage
import Foundation
import Vision

struct Failure: Error, CustomStringConvertible {
  let description: String
  init(_ description: String) { self.description = description }
}

func log(_ message: String) {
  FileHandle.standardError.write(Data("segment: \(message)\n".utf8))
}

// The rotation/flip ffmpeg applies on decode, as a Core Image orientation.
func orientation(_ t: CGAffineTransform) -> CGImagePropertyOrientation {
  switch (t.a.rounded(), t.b.rounded(), t.c.rounded(), t.d.rounded()) {
  case (0, 1, -1, 0): return .right
  case (0, -1, 1, 0): return .left
  case (-1, 0, 0, -1): return .down
  case (-1, 0, 0, 1): return .upMirrored
  case (1, 0, 0, -1): return .downMirrored
  case (0, 1, 1, 0): return .leftMirrored
  case (0, -1, -1, 0): return .rightMirrored
  default: return .up
  }
}

func segment(input: URL, start: Double, duration: Double, fps: Double, output: URL) async throws {
  let asset = AVURLAsset(url: input)
  guard let track = try await asset.loadTracks(withMediaType: .video).first else {
    throw Failure("no video track in \(input.path)")
  }
  let (natural, transform) = try await track.load(.naturalSize, .preferredTransform)
  let orient = orientation(transform)
  let shown = CGRect(origin: .zero, size: natural).applying(transform).size
  let width = Int(abs(shown.width).rounded())
  let height = Int(abs(shown.height).rounded())

  let reader = try AVAssetReader(asset: asset)
  // AVAssetReader stamps the frame already showing at the range start with the start time, which
  // would make it look like the first frame at `start`; begin a little early so it's dropped below.
  // Read past the end too: the last output frame is only settled once a later source frame arrives.
  let from = max(0, start - 0.1)
  reader.timeRange = CMTimeRange(
    start: CMTime(seconds: from, preferredTimescale: 90_000),
    duration: CMTime(seconds: start - from + duration + 1, preferredTimescale: 90_000))
  let frames = AVAssetReaderTrackOutput(
    track: track, outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA])
  frames.alwaysCopiesSampleData = false
  reader.add(frames)

  try? FileManager.default.removeItem(at: output)
  let writer = try AVAssetWriter(outputURL: output, fileType: .mov)
  let encoder = AVAssetWriterInput(
    mediaType: .video,
    outputSettings: [
      AVVideoCodecKey: AVVideoCodecType.h264,
      AVVideoWidthKey: width,
      AVVideoHeightKey: height,
      AVVideoColorPropertiesKey: [
        AVVideoColorPrimariesKey: AVVideoColorPrimaries_ITU_R_709_2,
        AVVideoTransferFunctionKey: AVVideoTransferFunction_ITU_R_709_2,
        AVVideoYCbCrMatrixKey: AVVideoYCbCrMatrix_ITU_R_709_2,
      ],
      AVVideoCompressionPropertiesKey: [
        // Masks compress well; this is generous so edges stay clean.
        AVVideoAverageBitRateKey: max(2_000_000, Int(Double(width * height) * fps * 0.12)),
        AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
        AVVideoMaxKeyFrameIntervalKey: max(1, Int(fps.rounded())),
        AVVideoAllowFrameReorderingKey: false,
        AVVideoExpectedSourceFrameRateKey: fps,
      ],
    ])
  encoder.expectsMediaDataInRealTime = false
  let adaptor = AVAssetWriterInputPixelBufferAdaptor(
    assetWriterInput: encoder,
    sourcePixelBufferAttributes: [
      kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange,
      kCVPixelBufferWidthKey as String: width,
      kCVPixelBufferHeightKey as String: height,
    ])
  writer.add(encoder)

  guard reader.startReading() else {
    throw Failure("can't read \(input.path): \(reader.error?.localizedDescription ?? "unknown error")")
  }
  guard writer.startWriting() else {
    throw Failure("can't write \(output.path): \(writer.error?.localizedDescription ?? "unknown error")")
  }
  writer.startSession(atSourceTime: .zero)

  let request = VNGeneratePersonSegmentationRequest()
  request.qualityLevel = .balanced
  request.outputPixelFormat = kCVPixelFormatType_OneComponent8
  // A sequence handler lets Vision smooth the mask from frame to frame.
  let vision = VNSequenceRequestHandler()

  // Mask values 0...255 become studio-range luma 16...235, which ffmpeg assumes for untagged yuv420p.
  let studio: [UInt8] = (0...255).map { (v: Int) -> UInt8 in UInt8(16 + (v * 219 + 127) / 255) }

  func matte(_ frame: CVPixelBuffer) throws -> CVPixelBuffer {
    try vision.perform([request], on: CIImage(cvPixelBuffer: frame).oriented(orient))
    guard let mask = request.results?.first?.pixelBuffer else { throw Failure("Vision returned no mask") }
    guard let pool = adaptor.pixelBufferPool else {
      throw Failure("encoder isn't ready: \(writer.error?.localizedDescription ?? "unknown error")")
    }
    var made: CVPixelBuffer?
    CVPixelBufferPoolCreatePixelBuffer(nil, pool, &made)
    guard let out = made else { throw Failure("out of frame buffers") }

    CVPixelBufferLockBaseAddress(mask, .readOnly)
    CVPixelBufferLockBaseAddress(out, [])
    defer {
      CVPixelBufferUnlockBaseAddress(out, [])
      CVPixelBufferUnlockBaseAddress(mask, .readOnly)
    }
    var src = vImage_Buffer(
      data: CVPixelBufferGetBaseAddress(mask),
      height: vImagePixelCount(CVPixelBufferGetHeight(mask)),
      width: vImagePixelCount(CVPixelBufferGetWidth(mask)),
      rowBytes: CVPixelBufferGetBytesPerRow(mask))
    var luma = vImage_Buffer(
      data: CVPixelBufferGetBaseAddressOfPlane(out, 0),
      height: vImagePixelCount(height), width: vImagePixelCount(width),
      rowBytes: CVPixelBufferGetBytesPerRowOfPlane(out, 0))
    var status = vImageScale_Planar8(&src, &luma, nil, vImage_Flags(kvImageNoFlags))
    if status == kvImageNoError { status = vImageTableLookUp_Planar8(&luma, &luma, studio, vImage_Flags(kvImageNoFlags)) }
    guard status == kvImageNoError else { throw Failure("mask scaling failed (\(status))") }
    memset(
      CVPixelBufferGetBaseAddressOfPlane(out, 1), 128,
      CVPixelBufferGetBytesPerRowOfPlane(out, 1) * CVPixelBufferGetHeightOfPlane(out, 1))
    return out
  }

  let total = max(1, Int((duration * fps).rounded()))
  var written = 0
  var lastReport = -1
  var cached: (pts: Double, mask: CVPixelBuffer)?

  func emit(_ frame: (pts: Double, pixels: CVPixelBuffer)) throws {
    if cached?.pts != frame.pts { cached = (frame.pts, try matte(frame.pixels)) }
    while !encoder.isReadyForMoreMediaData {
      if writer.status == .failed { break }
      Thread.sleep(forTimeInterval: 0.002)
    }
    let time = CMTime(value: CMTimeValue(written) * 1000, timescale: CMTimeScale((fps * 1000).rounded()))
    guard adaptor.append(cached!.mask, withPresentationTime: time) else {
      throw Failure("encoding failed: \(writer.error?.localizedDescription ?? "unknown error")")
    }
    written += 1
    let tenth = written * 10 / total
    if tenth != lastReport {
      lastReport = tenth
      log("\(tenth * 10)% (\(written)/\(total) frames)")
    }
  }

  // Pick source frames exactly like `ffmpeg -ss start -i input -vf fps=<fps>`: frames before
  // `start` are dropped, and output frame k shows the latest frame whose time rounds to k.
  // That way the matte lines up frame for frame with what the renderer decodes.
  var held: (pts: Double, pixels: CVPixelBuffer)?
  while written < total, let sample = frames.copyNextSampleBuffer() {
    guard let pixels = CMSampleBufferGetImageBuffer(sample) else { continue }
    let pts = CMSampleBufferGetPresentationTimeStamp(sample).seconds
    if pts < start - 1e-6 { continue }
    let slot = Int(((pts - start) * fps).rounded())
    while written < total, written < slot { try emit(held ?? (pts, pixels)) }
    held = (pts, pixels)
  }
  if reader.status == .failed {
    throw Failure("decoding failed: \(reader.error?.localizedDescription ?? "unknown error")")
  }
  reader.cancelReading()
  guard let last = held else { throw Failure("no video frames between \(start)s and \(start + duration)s") }
  // The source ended early: hold its last frame.
  while written < total { try emit(last) }

  encoder.markAsFinished()
  writer.endSession(atSourceTime: CMTime(value: CMTimeValue(total) * 1000, timescale: CMTimeScale((fps * 1000).rounded())))
  await writer.finishWriting()
  guard writer.status == .completed else {
    throw Failure("couldn't finish \(output.path): \(writer.error?.localizedDescription ?? "unknown error")")
  }
}

let args = CommandLine.arguments
guard args.count == 6, let start = Double(args[2]), let duration = Double(args[3]), let fps = Double(args[4]),
  start >= 0, duration > 0, fps > 0
else {
  log("usage: segment <input-video> <start-seconds> <duration-seconds> <fps> <out.mov>")
  exit(2)
}
guard FileManager.default.isReadableFile(atPath: args[1]) else {
  log("can't open \(args[1])")
  exit(1)
}
do {
  try await segment(
    input: URL(fileURLWithPath: args[1]), start: start, duration: duration, fps: fps,
    output: URL(fileURLWithPath: args[5]))
} catch {
  log("failed: \(error)")
  exit(1)
}
