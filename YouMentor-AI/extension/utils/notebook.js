import { getNote, saveNote } from "./storage.js";


// ======================================================
// SAVE AI AGENT TO NOTEBOOK
// ======================================================
//
// One YouTube video = One Study Page
//
// If the video already exists:
//     update that Study Page
//
// If it doesn't exist:
//     create a new Study Page
//
// Existing AI sections are NEVER deleted.
// ======================================================

export async function saveAgentToNotebook({

    videoId,
    title,
    url,
    agent,
    data

}) {

    if (!videoId) {

        throw new Error(
            "Unable to identify YouTube video."
        );

    }


    if (!agent) {

        throw new Error(
            "AI agent type is required."
        );

    }


    if (!data) {

        throw new Error(
            "No AI content to save."
        );

    }


    // Check whether this video already has a Study Page

    const existingNote =
        await getNote(videoId);


    // Create/update the same Study Page

    await saveNote({

        videoId,

        title:
            title || "YouTube Video",

        channel: "",

        thumbnail:
            `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,

        url,

        [agent]: data

    });


    return {

        created:
            !existingNote,

        updated:
            !!existingNote,

        note:
            await getNote(videoId)

    };

}


// ======================================================
// CHECK WHETHER A SPECIFIC AGENT IS SAVED
// ======================================================

export async function isAgentSaved(

    videoId,
    agent

) {

    if (!videoId) {

        return false;

    }


    const note =
        await getNote(videoId);


    return !!note?.[agent];

}