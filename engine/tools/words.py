# Word times with faster-whisper, for the edit engine's optional word-accurate path
# (ENGINE_WORD_TIMES=faster-whisper). Runs under the system Python, where faster_whisper is
# installed in the user's site-packages, and only from models already on disk.
#   python3 words.py <model> <language|auto> <prompt|-> <wav> [<wav> ...]
# One JSON line per file: {"file": ..., "language": ..., "words": [[start, end, text, p], ...]}
import json
import sys

from faster_whisper import WhisperModel

model, language, prompt, files = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4:]
m = WhisperModel(model, device="cpu", compute_type="int8", local_files_only=True)
for f in files:
    segments, info = m.transcribe(
        f,
        language=None if language == "auto" else language,
        beam_size=5,
        word_timestamps=True,
        vad_filter=False,
        condition_on_previous_text=False,
        initial_prompt=None if prompt == "-" else prompt,
    )
    words = [[round(w.start, 3), round(w.end, 3), w.word.strip(), round(w.probability, 3)] for s in segments for w in s.words]
    print(json.dumps({"file": f, "language": info.language, "words": words}), flush=True)
