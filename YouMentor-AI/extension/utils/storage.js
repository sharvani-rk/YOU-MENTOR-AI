// ======================================================
// GET ALL NOTES
// ======================================================

export async function getNotes() {

    const result = await chrome.storage.local.get("notes");

    return result.notes || [];

}


// ======================================================
// SAVE / UPDATE NOTE
// ======================================================
//
// One YouTube video = One Study Page
//
// If the video already exists,
// new agent data is merged into it.
//
// Example:
//
// Summary → save
// Vocabulary → save
//
// Result:
//
// {
//     videoId: "...",
//     summary: {...},
//     vocabulary: {...}
// }
//
// ======================================================

export async function saveNote(note) {

    const notes = await getNotes();

    const existingIndex = notes.findIndex(
        item => item.videoId === note.videoId
    );


    if (existingIndex !== -1) {

        // Existing Study Page
        const existingNote = notes[existingIndex];


        notes[existingIndex] = {

            ...existingNote,

            ...note,

            // Preserve existing AI content
            summary:
                note.summary ??
                existingNote.summary,

            explanation:
                note.explanation ??
                existingNote.explanation,

            vocabulary:
                note.vocabulary ??
                existingNote.vocabulary,

            quiz:
                note.quiz ??
                existingNote.quiz,

            flashcards:
                note.flashcards ??
                existingNote.flashcards,

            // Keep original creation time
            createdAt:
                existingNote.createdAt ||
                existingNote.savedAt ||
                new Date().toISOString(),

            // Update whenever something new is saved
            updatedAt:
                new Date().toISOString()

        };

    }

    else {

        // New Study Page
        notes.push({

            ...note,

            createdAt:
                note.createdAt ||
                new Date().toISOString(),

            updatedAt:
                new Date().toISOString()

        });

    }


    await chrome.storage.local.set({
        notes
    });

}


// ======================================================
// CHECK IF VIDEO IS SAVED
// ======================================================

export async function isSaved(videoId) {

    const notes = await getNotes();

    return notes.some(
        note => note.videoId === videoId
    );

}


// ======================================================
// DELETE COMPLETE STUDY PAGE
// ======================================================

export async function deleteNote(videoId) {

    const notes = await getNotes();

    const updatedNotes = notes.filter(
        note => note.videoId !== videoId
    );


    await chrome.storage.local.set({
        notes: updatedNotes
    });

}
// ======================================================
// GET ONE STUDY PAGE
// ======================================================

export async function getNote(videoId) {

    const notes = await getNotes();

    return notes.find(
        note => note.videoId === videoId
    ) || null;

}