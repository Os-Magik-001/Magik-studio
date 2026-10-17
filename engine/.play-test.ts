import { chromium, webkit } from "playwright-core";
import { db } from "/Users/aimenzen/Desktop/Magik-studio-main/engine/src/config.ts";
const { data: v } = await db.from("versions").select("storage_path").eq("video_id", "6235c063-b1d4-4337-86fb-b2baa52ae4c5").eq("number", 1).single();
const { data: s } = await db.storage.from("versions").createSignedUrl(v.storage_path, 600);
for (const [name, launch] of [["chrome", () => chromium.launch({ channel: "chrome" })], ["webkit", () => webkit.launch()]] as const) {
  try {
    const b = await launch();
    const p = await b.newPage({ viewport: { width: 500, height: 900 } });
    await p.setContent(`<video id=v src="${s.signedUrl}" playsinline muted preload="metadata" style="width:480px;height:854px;background:#000"></video>`);
    const r = await p.evaluate(async () => {
      const v = document.getElementById("v") as HTMLVideoElement;
      await new Promise((res, rej) => { v.onloadedmetadata = res; v.onerror = () => rej(new Error("error " + v.error?.code + " " + v.error?.message)); setTimeout(() => rej(new Error("timeout")), 20000); });
      v.currentTime = 12;
      await new Promise((res) => (v.onseeked = res));
      const c = document.createElement("canvas"); c.width = 40; c.height = 70; const g = c.getContext("2d")!; g.drawImage(v, 0, 0, 40, 70);
      const d = g.getImageData(0, 0, 40, 70).data; let sum = 0; for (let i = 0; i < d.length; i += 4) sum += d[i] + d[i + 1] + d[i + 2];
      return { w: v.videoWidth, h: v.videoHeight, dur: v.duration, avgBrightness: Math.round(sum / (d.length / 4) / 3) };
    });
    await p.screenshot({ path: `${process.argv[2]}/play-${name}.png` });
    console.log(name, JSON.stringify(r));
    await b.close();
  } catch (e) { console.log(name, "FAILED:", (e as Error).message.split("\n")[0]); }
}
