import {
    getNotes,
    deleteNote
} from "./utils/storage.js";


const notesContainer =
    document.getElementById("notesContainer");

const searchBox =
    document.getElementById("searchBox");

const noteCount =
    document.getElementById("noteCount");


let allNotes = [];


// Escape HTML to prevent broken markup
function escapeHTML(value) {

    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// Load notes
async function loadNotes() {

    try {

        allNotes = await getNotes();

        renderNotes(allNotes);

    } catch (error) {

        console.error(error);

        notesContainer.innerHTML = `
            <div class="empty">

                <h2>⚠️ Unable to load notebook</h2>

                <p>
                    Something went wrong while loading your study pages.
                </p>

            </div>
        `;

    }

}


// Render all notes
function renderNotes(notes) {

    noteCount.textContent =
        `${notes.length} ${notes.length === 1 ? "Study Page" : "Study Pages"}`;


    if (notes.length === 0) {

        notesContainer.innerHTML = `

            <div class="empty">

                <div class="empty-icon">
                    📚
                </div>

                <h2>Your notebook is empty</h2>

                <p>
                    Generate a Summary, Vocabulary, Flashcards,
                    Explanation or Quiz and add it to your notebook.
                </p>

            </div>

        `;

        return;
    }


    notesContainer.innerHTML = notes
        .map(note => createNoteCard(note))
        .join("");


    attachEvents();

}


// Create notebook card
function createNoteCard(note) {

    const videoId =
        escapeHTML(note.videoId);

    const title =
        escapeHTML(note.title || "Untitled Video");


    const savedDate =
        note.updatedAt || note.savedAt || note.createdAt;


    const dateText = savedDate
        ? new Date(savedDate).toLocaleString()
        : "Recently saved";


    const agentList = [];


    if (note.summary) {
        agentList.push("📄 Summary");
    }

    if (note.explanation) {
        agentList.push("💡 Explanation");
    }

    if (note.vocabulary) {
        agentList.push("📚 Vocabulary");
    }

    if (note.quiz) {
        agentList.push("🎯 Quiz");
    }

    if (note.flashcards) {
        agentList.push("🃏 Flashcards");
    }


    return `

        <div class="note-card"
             data-title="${title.toLowerCase()}">

            <div class="note-top">

                <img
                    src="${escapeHTML(note.thumbnail || "")}"
                    class="thumbnail"
                    alt="${title}"
                >


                <div class="note-info">

                    <h2>
                        ${title}
                    </h2>

                    <p class="date">
                        🕒 ${dateText}
                    </p>


                    <div class="agent-tags">

                        ${
                            agentList.length
                            ? agentList
                                .map(agent =>
                                    `<span>${agent}</span>`
                                )
                                .join("")
                            : `<span>📘 Study Material</span>`
                        }

                    </div>

                </div>

            </div>


            <div class="buttons">

                <button
                    class="openBtn"
                    data-id="${videoId}">
                    📖 Open Study Page
                </button>


                <button
                    class="youtubeBtn"
                    data-url="${escapeHTML(note.url || "")}">
                    ▶ Watch Video
                </button>


                <button
                    class="deleteBtn"
                    data-id="${videoId}">
                    🗑 Delete
                </button>

            </div>


            <div
                class="note-details"
                id="details-${videoId}"
                style="display:none;"
            >

                ${renderSummary(note)}

                ${renderExplanation(note)}

                ${renderVocabulary(note)}

                ${renderQuiz(note)}

                ${renderFlashcards(note)}

            </div>

        </div>

    `;

}


// SUMMARY
function renderSummary(note) {

    if (!note.summary) {
        return "";
    }


    const summary = note.summary;


    return `

        <section class="agent-section">

            <h3>📄 Summary</h3>


            ${
                summary.overview
                ? `
                    <div class="content-block">

                        <h4>Overview</h4>

                        <p>
                            ${escapeHTML(summary.overview)}
                        </p>

                    </div>
                `
                : ""
            }


            ${
                Array.isArray(summary.key_points)
                ? `

                    <div class="content-block">

                        <h4>Key Points</h4>

                        <ul>

                            ${
                                summary.key_points
                                .map(point =>
                                    `<li>${escapeHTML(point)}</li>`
                                )
                                .join("")
                            }

                        </ul>

                    </div>

                `
                : ""
            }


            ${
                Array.isArray(summary.important_concepts)
                ? `

                    <div class="content-block">

                        <h4>Important Concepts</h4>

                        ${
                            summary.important_concepts
                            .map(concept => `

                                <div class="concept">

                                    <strong>
                                        ${escapeHTML(concept.term)}
                                    </strong>

                                    <p>
                                        ${escapeHTML(concept.meaning)}
                                    </p>

                                </div>

                            `)
                            .join("")
                        }

                    </div>

                `
                : ""
            }


            ${
                summary.takeaway
                ? `

                    <div class="content-block">

                        <h4>🎯 Final Takeaway</h4>

                        <p>
                            ${escapeHTML(summary.takeaway)}
                        </p>

                    </div>

                `
                : ""
            }

        </section>

    `;

}


// ======================================================
// EXPLANATION
// ======================================================

function renderExplanation(note) {

    if (!note.explanation) {
        return "";
    }


    const explanation = note.explanation;


    return `

        <section class="agent-section">

            <h3>
                💡 Explanation
            </h3>


            ${
                explanation.overview
                ? `

                    <div class="content-block">

                        <h4>
                            💡 Overview
                        </h4>

                        <p>
                            ${escapeHTML(
                                explanation.overview
                            )}
                        </p>

                    </div>

                `
                : ""
            }


            ${
                Array.isArray(
                    explanation.concepts
                )
                ?

                `

                    <div class="content-block">

                        <h4>
                            📖 Concepts Explained
                        </h4>


                        ${
                            explanation.concepts
                                .map(
                                    concept => `

                                        <div class="concept">

                                            <strong>
                                                ${escapeHTML(
                                                    concept.term || ""
                                                )}
                                            </strong>


                                            ${
                                                concept.explanation
                                                ? `

                                                    <p>
                                                        ${escapeHTML(
                                                            concept.explanation
                                                        )}
                                                    </p>

                                                `
                                                : ""
                                            }


                                            ${
                                                concept.example
                                                ? `

                                                    <div class="example">

                                                        <strong>
                                                            💬 Example
                                                        </strong>

                                                        <p>
                                                            ${escapeHTML(
                                                                concept.example
                                                            )}
                                                        </p>

                                                    </div>

                                                `
                                                : ""
                                            }

                                        </div>

                                    `
                                )
                                .join("")
                        }

                    </div>

                `

                :

                ""
            }


            ${
                explanation.simple_explanation
                ? `

                    <div class="content-block">

                        <h4>
                            🧠 In Simple Words
                        </h4>

                        <p>
                            ${escapeHTML(
                                explanation.simple_explanation
                            )}
                        </p>

                    </div>

                `
                : ""
            }


            ${
                explanation.key_takeaway
                ? `

                    <div class="content-block">

                        <h4>
                            🎯 Key Takeaway
                        </h4>

                        <p>
                            ${escapeHTML(
                                explanation.key_takeaway
                            )}
                        </p>

                    </div>

                `
                : ""
            }

        </section>

    `;
}


// VOCABULARY
function renderVocabulary(note) {

    if (!note.vocabulary) {
        return "";
    }


    const vocabulary = note.vocabulary;


    if (!Array.isArray(vocabulary)) {

        return `

            <section class="agent-section">

                <h3>📚 Vocabulary</h3>

                <div class="content-block">

                    <pre>${escapeHTML(
                        JSON.stringify(vocabulary, null, 2)
                    )}</pre>

                </div>

            </section>

        `;

    }


    return `

        <section class="agent-section">

            <h3>📚 Vocabulary</h3>

            <div class="vocabulary-grid">

                ${
                    vocabulary
                    .map(word => `

                        <div class="vocabulary-card">

                            <div class="word">

                                ${escapeHTML(
                                    word.word ||
                                    word.term ||
                                    word.vocabulary ||
                                    ""
                                )}

                            </div>


                            ${
                                word.difficulty
                                ? `
                                    <span class="difficulty">
                                        ${escapeHTML(word.difficulty)}
                                    </span>
                                `
                                : ""
                            }


                            ${
                                word.simple_meaning ||
                                word.meaning
                                ? `
                                    <p>

                                        <strong>
                                            Simple Meaning:
                                        </strong>

                                        ${
                                            escapeHTML(
                                                word.simple_meaning ||
                                                word.meaning
                                            )
                                        }

                                    </p>
                                `
                                : ""
                            }


                            ${
                                word.in_video
                                ? `
                                    <p>

                                        <strong>
                                            In This Video:
                                        </strong>

                                        ${escapeHTML(word.in_video)}

                                    </p>
                                `
                                : ""
                            }


                            ${
                                word.example
                                ? `
                                    <p>

                                        <strong>
                                            Example:
                                        </strong>

                                        ${escapeHTML(word.example)}

                                    </p>
                                `
                                : ""
                            }

                        </div>

                    `)
                    .join("")
                }

            </div>

        </section>

    `;

}


// QUIZ
function renderQuiz(note) {

    if (!note.quiz) {
        return "";
    }


    return `

        <section class="agent-section">

            <h3>🎯 Quiz</h3>

            <div class="content-block">

                ${
                    Array.isArray(note.quiz)
                    ? note.quiz
                        .map((question, index) => `

                            <div class="quiz-card">

                                <h4>
                                    Question ${index + 1}
                                </h4>

                                <p>
                                    ${
                                        escapeHTML(
                                            question.question ||
                                            question.q ||
                                            ""
                                        )
                                    }
                                </p>

                                ${
                                    question.answer
                                    ? `
                                        <div class="answer">

                                            <strong>
                                                Answer:
                                            </strong>

                                            ${
                                                escapeHTML(
                                                    question.answer
                                                )
                                            }

                                        </div>
                                    `
                                    : ""
                                }

                            </div>

                        `)
                        .join("")
                    : `<pre>${escapeHTML(
                        JSON.stringify(note.quiz, null, 2)
                    )}</pre>`
                }

            </div>

        </section>

    `;

}


// FLASHCARDS
function renderFlashcards(note) {

    if (!note.flashcards) {
        return "";
    }


    return `

        <section class="agent-section">

            <h3>🃏 Flashcards</h3>

            <div class="flashcard-grid">

                ${
                    Array.isArray(note.flashcards)
                    ? note.flashcards
                        .map((card, index) => `

                            <div class="flashcard">

                                <div class="card-number">
                                    Card ${index + 1}
                                </div>

                                <h4>
                                    ${
                                        escapeHTML(
                                            card.question ||
                                            card.front ||
                                            ""
                                        )
                                    }
                                </h4>

                                ${
                                    card.answer ||
                                    card.back
                                    ? `
                                        <p>

                                            <strong>
                                                Answer:
                                            </strong>

                                            ${
                                                escapeHTML(
                                                    card.answer ||
                                                    card.back
                                                )
                                            }

                                        </p>
                                    `
                                    : ""
                                }

                            </div>

                        `)
                        .join("")
                    : `<pre>${escapeHTML(
                        JSON.stringify(
                            note.flashcards,
                            null,
                            2
                        )
                    )}</pre>`
                }

            </div>

        </section>

    `;

}


// Attach button events
function attachEvents() {


    // Open / Close
    document
        .querySelectorAll(".openBtn")
        .forEach(button => {

            button.addEventListener("click", () => {

                const videoId =
                    button.dataset.id;

                const details =
                    document.getElementById(
                        `details-${videoId}`
                    );


                if (details.style.display === "none") {

                    details.style.display = "block";

                    button.textContent =
                        "📕 Close Study Page";

                } else {

                    details.style.display = "none";

                    button.textContent =
                        "📖 Open Study Page";

                }

            });

        });


    // Delete
    document
        .querySelectorAll(".deleteBtn")
        .forEach(button => {

            button.addEventListener("click", async () => {

                const videoId =
                    button.dataset.id;


                if (
                    confirm(
                        "Delete this complete study page?"
                    )
                ) {

                    await deleteNote(videoId);

                    await loadNotes();

                }

            });

        });


    // YouTube
    document
        .querySelectorAll(".youtubeBtn")
        .forEach(button => {

            button.addEventListener("click", () => {

                const url =
                    button.dataset.url;

                if (url) {

                    chrome.tabs.create({
                        url
                    });

                }

            });

        });

}


// Search
searchBox.addEventListener(
    "input",
    () => {

        const query =
            searchBox.value
                .trim()
                .toLowerCase();


        if (!query) {

            renderNotes(allNotes);

            return;

        }


        const filtered =
            allNotes.filter(note => {

                const title =
                    (note.title || "")
                    .toLowerCase();


                const url =
                    (note.url || "")
                    .toLowerCase();


                return (
                    title.includes(query) ||
                    url.includes(query)
                );

            });


        renderNotes(filtered);

    }
);


// Automatically update if storage changes
chrome.storage.onChanged.addListener(
    (changes, areaName) => {

        if (
            areaName === "local" &&
            changes.notes
        ) {

            loadNotes();

        }

    }
);


// Initial load
loadNotes();