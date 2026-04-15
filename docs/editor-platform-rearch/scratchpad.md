To stop us from going the right direction and have to redesign our architecture we need to start from scratch

First, we need an example of editor system, native to the browser being used.

The web production editor runtime will feel like another improvement on an already infunctional system, that I don't really understand.

Capcut

WebAssembly - a binary instruction format for a stack-based vm , it is a portable compilation target for high-level languages (Rust, C++)
Enables code to run on the web at near-native speeds

WebAssembly parallel processing function: Single Instruction, Multiple Data

Emscripten provides a set of EH mechanisms based on javaScript, but they negatibely impact app's runtime performance

WebAssemmbly for EH(Exception Handling) reduced the package size of Capcut's web app by 15%

WebCodecs

For video editting, they need to decode the videos that users input into images and then display them on the editing canvas below the video preview

WIth SIMD-optimized decoder, decoding a 4k image to the editing canvas on a high-performance computer takes tens of milliseconds, meaning that decoding multiple tracks of video simultaneously requires a lot of power.

Using WebCodecs, CapCut integrated hardware-accelerated encoding and decoding, improving audio and video processing speed by nearly 300%. With the greatly improved performance, CapCut now supports multiple simultaneous 4K streams. Additionally, WebCodecs allowed support for more video formats, such as H264, HEVC, VP8, VP9, and AV1.

Video Editors in the browser:

VEED.io: Regarded as one of the best for replacing desktop software, offering a robust multitrack timeline, auto-subtitles, and AI tools for cleaning audio and removing backgrounds.
Kapwing: A highly collaborative tool known for its "Google Docs-style" real-time editing, making it great for teams. It features AI-powered transcription and text-based editing.
Microsoft Clipchamp: The official Microsoft video editor that runs in the browser (Edge/Chrome). It is user-friendly, features templates, and allows for 1080p exports without watermarks.
Canva Video Editor: Excellent for social media and marketing, offering intuitive drag-and-drop editing, numerous templates, and live real-time collaboration.
CapCut (Online): A very popular free editor that brings mobile-like ease to the web, featuring advanced tools like keyframing, chroma key (green screen), and auto-background removal.
Flixier: Known for fast, cloud-based rendering and AI integration, allowing for editing in the timeline and publishing without extensive waiting times.
WeVideo: A long-standing browser-based editor that offers robust editing capabilities and is often used for education and business. 
https://pikimov.com/


--------

Commercial video developer here… If you want to learn to work with video you need to start with simple goals and build upwards. Start by learning what h.264 is and how video is compressed. What are I, P, and B frames? Then learn something about video container formats like mp4. Video editing is done in C. All other languages wrap C libraries for this and this obfuscates what is going on. Before you can write an editor you need to be able to write a player. Start by writing a player than can open a video file and decode and display the first frame. Here is a tutorial for how to do that in less than 1k lines of C: http://dranger.com/ffmpeg/ffmpeg.html. This is like the movie Karate Kid. You’ve got to “sand-du-floor” before you can Crane-Kick standing on the bow of a boat…. Or you can wuss out and say it’s too hard… 

------------


 WASM.

Video players either bring in outside components or rely on the web browser’s built-in abilities.

Bringing in outside components for something as CPU intensive as video editing slows browsers down a lot, due to how the JavaScript engines execute code.

Maybe someday in the future, things will get better. In the meantime, code your video editor in rust, compile to WASM, and import the WASM into the web browser via a web page.

https://www.rust-lang.org/what/wasm

--------



