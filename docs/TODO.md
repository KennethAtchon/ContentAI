I keep seeing many times, clicking on "open chat session" or "ai chat" doesnt actually do anything, can you fix this to make it actually open up the CORRECT AI chat for the draft or create one if it doesnt already exists. Do deep research and use skills. 


for our project I ahve a few complaints id like you to research: when creating video clips via the "generate tab" using
  AI to create it, the clips appear in the "video" column out of order and not organized, when we generate clips via the
  AI interface into the editor, the final product MUST Be a well generated video, right now videos are stacked against
  each other and uneven. Also we need a way to ~ not prevent ~ but stop videos from being stacked ontop of each other, if 
  users want to blend them together or do something then we can give them the option of creating a new "video" timeline    
  (and make the different timelines scrollable so this scales). and also this thing gets created:  

  nspector

Clip

Name
Bold text on screen: 'Learn more about your favorite animals! Follow us!'
Start
25.00s
Duration
3.00s
Speed

1×
Enabled

Look

Opacity

1
Warmth

0
Contrast

0
Transform

X
0
Y
0
Scale

1
Rotation

0
Sound

Volume

1
Mute
, what does this thing represent? If its literally just text why isnt it in the text column? Our translation layer between AI generated -> editor is broken. This text should be in the "text" portion of the timeline, right now its in video, 

Also we need to revamp the "text" bar to be generable text like...CAPTIONS
The options for the text tab should NOT be title, subtitle, caption. It should be what THEME the text it (you have to research the top 5 most common captions). Also rename "text" tab to "caption". The options for making it a title, subtitle, caption, should be part of the "inspector" when u click the caption. Also the enabled button appears offscreen when its turned off (so does mute button).
And voiceovers and shots dont have the audio wave thing? Are they broken


create a feature request doc using ur pm skill, what I see missing from the editor right now: right clicking empty space results in    
"paste here" which doesnt make sense, what do you want me to paste??? a clip?? clips are a separate entity, did they want me to COPY     
another clip? maybe make that clear, but the right click on empty space should allow to create a new clip too (based on which track they 
 are adding the new clip too), right now the text clip shows the text on screen, this is good but the problem is no way to change size,  
all the text shows up at the same time (we need an algorithm to show the "correct" amount of text per moment in the screen) , bug: I     
HAVE to reload the page in order for my projects in /studio/generate to show, another bug is users can search clips and text *BEYOND*    
their max size which makes no sense, we should just allow *duplicating* the clip onto the timeline. Every clip needs a max clip. Also a  
bug: When duplicating clips, it causes them to overlap (we want to strictly enforce clips not overlapping in the same track, and fix it  
when it happens, duplicates should append at the END) 



alot bugs popped up when u were implementing: /home/kenneth/Documents/Workplace/ContentAI/docs/architecture/lld-multi-video-tracks.md  
too, the add new track button is at the bottom...why? just put it in the side with the lock buttons...also the tracks need to be         
scrollable...also when u add a new video track it supports to appear BELOW the existing one not at the end...also ensure video tracks    
dont mess up each others state    