computelayout, renderframe, html5 canvas


-----

theres a bunch of minor user-ability thigns that I see in my application that just makes it annoying and not optimized,  
  these are very fixable stuff, like when I edit an editor, it doesnt edit immediately, I have to refresh the page, when I  
  delete a chat message, the editor for it stays up but all underlying resources are gone, maybe we should have cascade     
  delete or have a strategy for preserving resources and allowing the user to "recreate" or giving the user the choice to   
  cascaqde delete or keep the editor instance. When a chat message is deleted *I think* the underlying, like videos are     
  also deleted which should be the case. We need to write a clear markdown. Not just tackling these users but all           
  userbility issues that make the website confusing to work with. Very flow should be clear and deterministic on what it    
  should do, limit side effects unless the user asks for it, so can you write a markdown plan for me? 