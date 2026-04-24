# 1. Preview runtime and react are still tighty coupled

While the preview is running, react is rerendering. According to million, when playing the video for 10 seconds, react rerenders the component holding preview 300 times. This is not the way to make this work.

# 2. Preview is very slow and laggy

Preview when rendering every frame at a time, it is lagging. Can you observe our current system and find out if theres a better way to do things?

 00:00:15:07 -> 00:00:15:16

 The preview is jumping frames, it isn't playing each frame by frame. It is not running 60 fps, maybe like 5-10 FPS, have an estimated FPS on the screen so we know. This is a major  bug in this implement

------

I want you to take these two bugs and figure out whats causing them and how to fix.

I dont want incremental changes, don't provide those as options at all. I want huge changes. that fundamentally separate preview runtime from react and rearchitectures it completely. I dont care about backwards compatibility, we are still developing the app. I just want to use an app development pattern that has been proven to work in other video editors.