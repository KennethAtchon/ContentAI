- Research manual reel extraction process with a headless browser or something running on the server, this will be another option alongside Apify scraper, Handle rate limits and use proxies, and need to make this scalable and resistant to breaking

- Add a discovery button to the user menu button (I know its getting kind of crowded but this should be the final button, because the current way to get to discovery is, account -> discovery tab)

- We need to re-imagine the generate tab. Generate should be used by users to talk to AI and generate like reels themself. So what I imagine is, it should look like chatgpt or claude or another AI chat interface. Users are given a choice to create a *project* about a *niche* - and this niche WILL NOT be part of the system wide niches. I say this because system wide niches are created by admins, this niche is created by users. This niche serves as a ENUM, the other niche serves as a catalog item. Anyways once they create a new project and have a niche for it. They can reference reels, either by like picking them from some sort of option we give them (i dont know how this will look yet) or they can just tag the reel if they know the name @ (will this have overhead? if we have 100k niches, will @ing be the right approach?) Anyways, does are some idea for a way users can reference them, glad to hear your ideas.

- After niche references the videos the AI, will scan and find out what makes the video special and made people click it. (we will have a specialized AI for analyze). Then we need a process for actually creating the reel (audio, video(this will be AI generated or user provides something), editting(might need to expand this section into some sort of AI editting suite but this is TBD), everything else needed for a video like hashtags or whatever). 

- Anything else I missed, can you catch them and let me know, these are just my raw thoughts for fully building out the generate tab. The queue tab will be very easy, it will just show generated content, and act like a way for users to view, delete, edit, their generated videos. (for edit, I think it will just redirect to the project in the generate tab, if the project is deleted ~ it will get tricky, so may need to add an option to "edit existing video" and then use that flow for that use case. )

So tldr on the TODOs:

- Generate (this will be the bulk of the work we are doing for this project and what users are paying subscription for)
- Queue (easy CRUD thing)

- We also need to ensure the proper usage blockers are in place and they are hard blockers that can't be jail broken. 

- We also need to track how much we are spending on AI models on the admin portal. 

- Also need to delete this from discover:

<div class="flex border-b border-white/[0.05] shrink-0"><button class="flex-1 py-2.5 text-[11px] font-medium text-center cursor-pointer bg-transparent border-0 border-b-2 transition-all duration-150 font-studio focus-visible:outline-none text-slate-200/35 border-b-transparent hover:text-slate-200/60">studio_panel_analysis</button><button class="flex-1 py-2.5 text-[11px] font-medium text-center cursor-pointer bg-transparent border-0 border-b-2 transition-all duration-150 font-studio focus-visible:outline-none text-slate-200/35 border-b-transparent hover:text-slate-200/60">studio_panel_generate</button><button class="flex-1 py-2.5 text-[11px] font-medium text-center cursor-pointer bg-transparent border-0 border-b-2 transition-all duration-150 font-studio focus-visible:outline-none text-studio-accent border-b-studio-accent">History</button></div>

- Also for discover page, everyday should rotate views, and we need a background scan going on, and discovery should prioritize date and then views (like on the same day)

- Also need discovery to have a "top out of all niches" it will just show whats trending, might be a complicated union

