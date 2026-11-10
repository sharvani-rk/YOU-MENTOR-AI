import {
    saveAgentToNotebook,
    isAgentSaved
} from "./utils/notebook.js";
// ======================================================
// DOM ELEMENTS
// ======================================================

const summaryBtn = document.getElementById("summaryBtn");
const explainBtn = document.getElementById("explainBtn");
const quizBtn = document.getElementById("quizBtn");
const vocabularyBtn = document.getElementById("vocabularyBtn");
const flashcardsBtn = document.getElementById("flashcardsBtn");

const output = document.getElementById("output");
const notesBtn = document.getElementById("notesBtn");


// ======================================================
// GLOBAL VARIABLES
// ======================================================

let currentVideoUrl = "";
let currentVideoTitle = "";

let currentSummary = null;
let currentQuiz = null;
let currentVocabulary = null;
let currentFlashcards = null;


// ======================================================
// GET VIDEO ID
// ======================================================

function getVideoId(url) {

    try {

        const parsed = new URL(url);

        return parsed.searchParams.get("v");

    }

    catch (error) {

        return null;

    }

}


// ======================================================
// GET CURRENT VIDEO
// ======================================================

async function getCurrentVideo() {

    const [tab] = await chrome.tabs.query({

        active: true,
        currentWindow: true

    });


    if (!tab || !tab.url) {

        throw new Error(
            "Unable to detect current YouTube video."
        );

    }


    if (
        !tab.url.includes("youtube.com/watch") &&
        !tab.url.includes("youtu.be/")
    ) {

        throw new Error(
            "Please open a YouTube video first."
        );

    }


    currentVideoUrl = tab.url;

    currentVideoTitle =
        tab.title || "YouTube Video";


    return tab;

}


// ======================================================
// SHOW LOADING
// ======================================================

function showLoading(message) {

    output.innerHTML = `

        <div class="loading">

            <div class="spinner"></div>

            <p>${message}</p>

        </div>

    `;

}


// ======================================================
// SHOW ERROR
// ======================================================

function showError(message) {

    output.innerHTML = `

        <div class="section error-section">

            <h2>
                ❌ Error
            </h2>

            <p>
                ${message}
            </p>

        </div>

    `;

}


// ======================================================
// TOAST
// ======================================================

function showToast(message, success = true) {

    const toast =
        document.createElement("div");

    toast.className = "toast";

    if (!success) {

        toast.classList.add("error");

    }

    toast.textContent = message;

    document.body.appendChild(toast);


    setTimeout(() => {

        toast.classList.add("show");

    }, 100);


    setTimeout(() => {

        toast.remove();

    }, 3000);

}


// ======================================================
// MY NOTES
// ======================================================

notesBtn.addEventListener("click", () => {

    chrome.tabs.create({

        url: chrome.runtime.getURL(
            "notes.html"
        )

    });

});


// ======================================================
// SUMMARY AGENT
// ======================================================

summaryBtn.addEventListener(
    "click",
    async () => {

        showLoading(
            "Generating AI Summary..."
        );


        try {

            await getCurrentVideo();


            const response = await fetch(
                "http://127.0.0.1:5000/summary",
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        url: currentVideoUrl
                    })

                }
            );


            if (!response.ok) {

                throw new Error(
                    `Backend returned ${response.status}`
                );

            }


            const data =
                await response.json();


            if (data.success === false) {

                throw new Error(
                    data.message
                );

            }


            currentSummary =
                data.summary;


            renderSummary();

        }

        catch (error) {

            console.error(error);

            showError(error.message);

        }

    }
);


// ======================================================
// RENDER SUMMARY
// ======================================================

async function renderSummary() {

    const videoId =
        getVideoId(currentVideoUrl);


    let alreadySaved = false;


    if (videoId) {

        alreadySaved =
            await isAgentSaved(
            videoId,
            "summary"
        );

    }


    output.innerHTML = `

        <div class="section">

            <h2>
                📄 Overview
            </h2>

            <p>
                ${currentSummary.overview || ""}
            </p>

        </div>


        <div class="section">

            <h2>
                🔑 Key Points
            </h2>

            <ul>

                ${
                    Array.isArray(
                        currentSummary.key_points
                    )

                    ?

                    currentSummary.key_points
                        .map(
                            point =>
                                `<li>${point}</li>`
                        )
                        .join("")

                    :

                    "<li>No key points available.</li>"
                }

            </ul>

        </div>


        <div class="section">

            <h2>
                💡 Important Concepts
            </h2>

            ${
                Array.isArray(
                    currentSummary.important_concepts
                )

                ?

                currentSummary.important_concepts
                    .map(
                        concept => `

                            <div class="concept">

                                <strong>
                                    ${concept.term}
                                </strong>

                                <p>
                                    ${concept.meaning}
                                </p>

                            </div>

                        `
                    )
                    .join("")

                :

                "<p>No concepts available.</p>"
            }

        </div>


        <div class="section">

            <h2>
                🎯 Final Takeaway
            </h2>

            <p>
                ${currentSummary.takeaway || ""}
            </p>

        </div>


        <button
            id="saveSummaryBtn"
            class="save-btn"
            ${alreadySaved ? "disabled" : ""}
        >

            ${
                alreadySaved
                ? "✔ Saved to Notes"
                : "📥 Add to Notes"
            }

        </button>

    `;


    const saveButton =
        document.getElementById(
            "saveSummaryBtn"
        );


    if (!alreadySaved) {

        saveButton.addEventListener(
            "click",
            async () => {

                try {

                    await saveAgentToNotebook({

                    videoId,

                    title:
                        currentVideoTitle,

                    url:
                        currentVideoUrl,

                    agent:
                        "summary",

                    data:
                        currentSummary

                });


                saveButton.textContent =
                    "✔ Saved to Notes";

                saveButton.disabled =
                    true;


                showToast(
                    "✅ Summary added to My Notes!"
                );

            }

                catch (error) {

                    console.error(error);

                    showToast(
                        "Unable to save note.",
                        false
                    );

                }

            }
        );

    }

}


// ======================================================
// EXPLANATION AGENT
// ======================================================

explainBtn.addEventListener(
    "click",
    async () => {

        showLoading(
            "Generating AI Explanation..."
        );


        try {

            await getCurrentVideo();


            const response = await fetch(
                "http://127.0.0.1:5000/explain",
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        url: currentVideoUrl
                    })

                }
            );


            if (!response.ok) {

                throw new Error(
                    `Backend returned ${response.status}`
                );

            }


            const data =
                await response.json();


            if (data.success === false) {

                throw new Error(
                    data.message
                );

            }


            const explanation =
                data.explanation;


            renderExplanation(
                explanation
            );

        }

        catch (error) {

            console.error(error);

            showError(error.message);

        }

    }
);


// ======================================================
// RENDER EXPLANATION
// ======================================================

async function renderExplanation(explanation) {

    output.innerHTML = `

        <div class="section">

            <h2>
                💡 Overview
            </h2>

            <p>
                ${explanation.overview || ""}
            </p>

        </div>


        <div class="section">

            <h2>
                📖 Concepts Explained
            </h2>

            ${
                Array.isArray(
                    explanation.concepts
                )

                ?

                explanation.concepts
                    .map(
                        concept => `

                            <div class="concept">

                                <strong>
                                    ${concept.term}
                                </strong>

                                <p>
                                    ${concept.explanation}
                                </p>


                                ${
                                    concept.example

                                    ?

                                    `

                                        <div class="example">

                                            <strong>
                                                💬 Example
                                            </strong>

                                            <p>
                                                ${concept.example}
                                            </p>

                                        </div>

                                    `

                                    :

                                    ""
                                }

                            </div>

                        `
                    )
                    .join("")

                :

                "<p>No concepts available.</p>"
            }

        </div>


        <div class="section">

            <h2>
                🧠 In Simple Words
            </h2>

            <p>
                ${explanation.simple_explanation || ""}
            </p>

        </div>


        <div class="section">

            <h2>
                🎯 Key Takeaway
            </h2>

            <p>
                ${explanation.key_takeaway || ""}
            </p>

        </div>
        <button
            id="saveExplanationBtn"
            class="save-btn"
        >
            📥 Add Explanation to Notes
        </button>

    `;
    const saveButton =
    document.getElementById("saveExplanationBtn");

const videoId =
    getVideoId(currentVideoUrl);

const alreadySaved =
    await isAgentSaved(
        videoId,
        "explanation"
    );

if (alreadySaved) {

    saveButton.textContent =
        "✔ Explanation Saved";

    saveButton.disabled = true;

}
else {

    saveButton.addEventListener(
        "click",
        async () => {

            try {

                await saveAgentToNotebook({

                    videoId,

                    title: currentVideoTitle,

                    url: currentVideoUrl,

                    agent: "explanation",

                    data: explanation

                });

                saveButton.textContent =
                    "✔ Explanation Saved";

                saveButton.disabled = true;

                showToast(
                    "✅ Explanation added to My Notes!"
                );

            }

            catch (error) {

                console.error(error);

                showToast(
                    "Unable to save explanation.",
                    false
                );

            }

        }
    );

}

}


// ======================================================
// QUIZ AGENT
// ======================================================

quizBtn.addEventListener(
    "click",
    async () => {

        showLoading(
            "Generating Quiz..."
        );


        try {

            await getCurrentVideo();


            const response = await fetch(
                "http://127.0.0.1:5000/quiz",
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        url: currentVideoUrl
                    })

                }
            );


            if (!response.ok) {

                throw new Error(
                    `Backend returned ${response.status}`
                );

            }


            const data =
                await response.json();


            if (data.success === false) {

                throw new Error(
                    data.message
                );

            }


            currentQuiz =
                data.quiz;


            startQuiz(currentQuiz);

        }

        catch (error) {

            console.error(error);

            showError(error.message);

        }

    }
);


// ======================================================
// START QUIZ
// ======================================================

function startQuiz(quiz) {

    if (
        !quiz ||
        !Array.isArray(quiz.questions) ||
        quiz.questions.length === 0
    ) {

        throw new Error(
            "Invalid quiz data."
        );

    }


    let currentQuestion = 0;

    let score = 0;


    renderQuestion();


    function renderQuestion() {

        const question =
            quiz.questions[currentQuestion];


        output.innerHTML = `

            <div class="section quiz-card">

                <div class="quiz-header">

                    <h2>
                        🎯 ${quiz.title || "Video Quiz"}
                    </h2>

                    <span>
                        ${currentQuestion + 1}
                        /
                        ${quiz.questions.length}
                    </span>

                </div>


                <div class="progress-bar">

                    <div
                        class="progress"
                        style="
                            width:
                            ${
                                (
                                    (currentQuestion + 1)
                                    /
                                    quiz.questions.length
                                ) * 100
                            }%;
                        "
                    ></div>

                </div>


                <h3 class="question-text">

                    ${question.question}

                </h3>


                <div class="quiz-options">

                    ${
                        question.options
                            .map(
                                option => `

                                    <button
                                        class="quiz-option"
                                    >
                                        ${option}
                                    </button>

                                `
                            )
                            .join("")
                    }

                </div>


                <div
                    id="quizFeedback"
                    class="quiz-feedback"
                ></div>


                <button
                    id="nextQuestionBtn"
                    class="next-btn"
                    disabled
                >

                    ${
                        currentQuestion ===
                        quiz.questions.length - 1

                        ?

                        "Finish Quiz 🎉"

                        :

                        "Next Question →"
                    }

                </button>

            </div>

        `;


        const buttons =
            document.querySelectorAll(
                ".quiz-option"
            );


        const feedback =
            document.getElementById(
                "quizFeedback"
            );


        const nextButton =
            document.getElementById(
                "nextQuestionBtn"
            );


        let answered = false;


        buttons.forEach(
            (button, index) => {

                button.addEventListener(
                    "click",
                    () => {

                        if (answered) {
                            return;
                        }


                        answered = true;


                        const selected =
                            question.options[index];


                        const correct =
                            question.correct_answer;


                        buttons.forEach(
                            btn => {
                                btn.disabled = true;
                            }
                        );


                        if (
                            selected ===
                            correct
                        ) {

                            score++;


                            button.classList.add(
                                "correct"
                            );


                            feedback.innerHTML = `

                                <strong>
                                    ✅ Correct!
                                </strong>

                                <p>
                                    ${question.explanation}
                                </p>

                            `;

                        }

                        else {

                            button.classList.add(
                                "wrong"
                            );


                            buttons.forEach(
                                btn => {

                                    if (
                                        btn.textContent
                                            .trim() ===
                                        correct
                                    ) {

                                        btn.classList.add(
                                            "correct"
                                        );

                                    }

                                }
                            );


                            feedback.innerHTML = `

                                <strong>
                                    ❌ Incorrect
                                </strong>

                                <p>
                                    Correct answer:
                                    <strong>
                                        ${correct}
                                    </strong>
                                </p>

                                <p>
                                    ${question.explanation}
                                </p>

                            `;

                        }


                        nextButton.disabled =
                            false;

                    }
                );

            }
        );


        nextButton.addEventListener(
            "click",
            () => {

                if (
                    currentQuestion <
                    quiz.questions.length - 1
                ) {

                    currentQuestion++;

                    renderQuestion();

                }

                else {

                    showQuizResult();

                }

            }
        );

    }


    function showQuizResult() {

        const total =
            quiz.questions.length;


        const percentage =
            Math.round(
                (score / total) * 100
            );


        let message;


        if (percentage === 100) {

            message =
                "🏆 Perfect score! Excellent work!";

        }

        else if (percentage >= 80) {

            message =
                "🎉 Great job! You understand the topic well.";

        }

        else if (percentage >= 60) {

            message =
                "👍 Good effort! Review the topic once more.";

        }

        else {

            message =
                "📚 Keep learning! Try the Summary and Explanation again.";

        }


        output.innerHTML = `

            <div class="section quiz-result">

                <h2>
                    🎉 Quiz Complete!
                </h2>


                <div class="score">

                    ${score}/${total}

                </div>


                <div class="percentage">

                    ${percentage}%

                </div>


                <p>
                    ${message}
                </p>


                <button
                    id="retryQuizBtn"
                    class="next-btn"
                >
                    🔄 Try Again
                </button>

            </div>

        `;


        document
            .getElementById("retryQuizBtn")
            .addEventListener(
                "click",
                () => {

                    startQuiz(quiz);

                }
            );

    }

}


// ======================================================
// VOCABULARY AGENT
// ======================================================

vocabularyBtn.addEventListener(
    "click",
    async () => {

        showLoading(
            "Generating Important Vocabulary..."
        );


        try {

            await getCurrentVideo();


            const response = await fetch(
                "http://127.0.0.1:5000/vocabulary",
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        url: currentVideoUrl
                    })

                }
            );


            if (!response.ok) {

                throw new Error(
                    `Backend returned ${response.status}`
                );

            }


            const data =
                await response.json();


            if (data.success === false) {

                throw new Error(
                    data.message
                );

            }


            currentVocabulary =
                data.vocabulary;


            renderVocabulary(
                currentVocabulary
            );

        }

        catch (error) {

            console.error(error);

            showError(error.message);

        }

    }
);


// ======================================================
// RENDER VOCABULARY
// ======================================================

function renderVocabulary(vocabulary) {

    if (
        !vocabulary ||
        !Array.isArray(vocabulary.words)
    ) {

        throw new Error(
            "Invalid vocabulary data."
        );

    }


    output.innerHTML = `

        <div class="section vocabulary-title">

            <h2>
                📚 ${vocabulary.title || "Important Vocabulary"}
            </h2>

            <p>
                Important terms from this video
            </p>

        </div>


        ${
            vocabulary.words
                .map(
                    word => `

                        <div class="section vocabulary-card">

                            <div class="vocabulary-header">

                                <h2>
                                    ${word.term}
                                </h2>

                                <span
                                    class="
                                        difficulty
                                        ${word.difficulty}
                                    "
                                >
                                    ${word.difficulty}
                                </span>

                            </div>


                            <div class="vocabulary-item">

                                <strong>
                                    🟢 Simple Meaning
                                </strong>

                                <p>
                                    ${word.simple_meaning}
                                </p>

                            </div>


                            <div class="vocabulary-item">

                                <strong>
                                    🎓 In This Video
                                </strong>

                                <p>
                                    ${word.contextual_meaning}
                                </p>

                            </div>


                            <div class="vocabulary-item">

                                <strong>
                                    💬 Example
                                </strong>

                                <p>
                                    ${word.example}
                                </p>

                            </div>

                        </div>

                    `
                )
                .join("")
        }

    `;

}


// ======================================================
// FLASHCARD AGENT
// ======================================================

flashcardsBtn.addEventListener(
    "click",
    async () => {

        showLoading(
            "Creating AI Flashcards..."
        );


        try {

            await getCurrentVideo();


            const response = await fetch(
                "http://127.0.0.1:5000/flashcards",
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        url: currentVideoUrl
                    })

                }
            );


            if (!response.ok) {

                throw new Error(
                    `Backend returned ${response.status}`
                );

            }


            const data =
                await response.json();


            if (data.success === false) {

                throw new Error(
                    data.message
                );

            }


            currentFlashcards =
                data.flashcards;


            startFlashcards(
                currentFlashcards
            );

        }

        catch (error) {

            console.error(error);

            showError(error.message);

        }

    }
);


// ======================================================
// FLASHCARD SYSTEM
// ======================================================

function startFlashcards(data) {

    if (
        !data ||
        !Array.isArray(data.cards) ||
        data.cards.length === 0
    ) {

        throw new Error(
            "Invalid flashcard data."
        );

    }


    let currentCard = 0;

    let revealed = false;


    renderCard();


    function renderCard() {

        const card =
            data.cards[currentCard];


        revealed = false;


        output.innerHTML = `

            <div class="flashcard-container">

                <div class="flashcard-top">

                    <h2>
                        🃏 ${data.title || "Study Flashcards"}
                    </h2>

                    <span>
                        Card
                        ${currentCard + 1}
                        /
                        ${data.cards.length}
                    </span>

                </div>


                <div class="progress-bar">

                    <div
                        class="progress"
                        style="
                            width:
                            ${
                                (
                                    (currentCard + 1)
                                    /
                                    data.cards.length
                                ) * 100
                            }%;
                        "
                    ></div>

                </div>


                <div
                    id="flashcard"
                    class="flashcard"
                >

                    <div class="flashcard-content">

                        <span class="card-label">
                            QUESTION
                        </span>

                        <h3 id="cardFront">

                            ${card.front}

                        </h3>


                        <div
                            id="cardBack"
                            class="card-back hidden"
                        >

                            <span class="card-label">
                                ANSWER
                            </span>

                            <p>
                                ${card.back}
                            </p>

                        </div>

                    </div>

                </div>


                <div class="difficulty-container">

                    <span
                        class="
                            difficulty
                            ${card.difficulty}
                        "
                    >
                        ${card.difficulty}
                    </span>

                </div>


                <button
                    id="revealBtn"
                    class="reveal-btn"
                >
                    👁 Reveal Answer
                </button>


                <div class="flashcard-navigation">

                    <button
                        id="previousCardBtn"
                        class="nav-btn"
                        ${currentCard === 0 ? "disabled" : ""}
                    >
                        ← Previous
                    </button>


                    <button
                        id="nextCardBtn"
                        class="nav-btn"
                    >

                        ${
                            currentCard ===
                            data.cards.length - 1

                            ?

                            "Finish 🎉"

                            :

                            "Next →"
                        }

                    </button>

                </div>


                <button
                    id="shuffleBtn"
                    class="shuffle-btn"
                >
                    🔀 Shuffle Cards
                </button>

            </div>

        `;


        const revealBtn =
            document.getElementById(
                "revealBtn"
            );


        const back =
            document.getElementById(
                "cardBack"
            );


        const previousBtn =
            document.getElementById(
                "previousCardBtn"
            );


        const nextBtn =
            document.getElementById(
                "nextCardBtn"
            );


        const shuffleBtn =
            document.getElementById(
                "shuffleBtn"
            );


        // ----------------------------------------------
        // REVEAL
        // ----------------------------------------------

        revealBtn.addEventListener(
            "click",
            () => {

                revealed = !revealed;


                if (revealed) {

                    back.classList.remove(
                        "hidden"
                    );

                    revealBtn.textContent =
                        "🙈 Hide Answer";

                }

                else {

                    back.classList.add(
                        "hidden"
                    );

                    revealBtn.textContent =
                        "👁 Reveal Answer";

                }

            }
        );


        // ----------------------------------------------
        // PREVIOUS
        // ----------------------------------------------

        previousBtn.addEventListener(
            "click",
            () => {

                if (currentCard > 0) {

                    currentCard--;

                    renderCard();

                }

            }
        );


        // ----------------------------------------------
        // NEXT
        // ----------------------------------------------

        nextBtn.addEventListener(
            "click",
            () => {

                if (
                    currentCard <
                    data.cards.length - 1
                ) {

                    currentCard++;

                    renderCard();

                }

                else {

                    showFlashcardComplete();

                }

            }
        );


        // ----------------------------------------------
        // SHUFFLE
        // ----------------------------------------------

        shuffleBtn.addEventListener(
            "click",
            () => {

                data.cards =
                    [...data.cards]
                    .sort(
                        () => Math.random() - 0.5
                    );


                currentCard = 0;

                renderCard();

            }
        );

    }


    function showFlashcardComplete() {

        output.innerHTML = `

            <div class="section flashcard-result">

                <div class="completion-icon">
                    🎉
                </div>

                <h2>
                    Flashcards Complete!
                </h2>

                <p>
                    You reviewed all
                    ${data.cards.length}
                    flashcards.
                </p>


                <button
                    id="restartFlashcardsBtn"
                    class="next-btn"
                >
                    🔄 Review Again
                </button>

            </div>

        `;


        document
            .getElementById(
                "restartFlashcardsBtn"
            )
            .addEventListener(
                "click",
                () => {

                    currentCard = 0;

                    renderCard();

                }
            );

    }

}

/* =========================================
   AUDIO TRANSCRIPTION & SUMMARY
   ========================================= */

const audioFileInput = document.getElementById("audioFile");
const languageSelect = document.getElementById("languageSelect");
const transcribeAudioBtn = document.getElementById("transcribeAudioBtn");
const audioStatus = document.getElementById("audioStatus");
const audioOutput = document.getElementById("audioOutput");

if (
    audioFileInput &&
    languageSelect &&
    transcribeAudioBtn &&
    audioStatus &&
    audioOutput
) {
    transcribeAudioBtn.addEventListener("click", async () => {
        const audioFile = audioFileInput.files[0];

        if (!audioFile) {
            audioStatus.textContent = "Please choose an audio file first.";
            return;
        }

        const formData = new FormData();
        formData.append("audio", audioFile);
        formData.append(
            "language_code",
            languageSelect.value || "en-IN"
        );

        transcribeAudioBtn.disabled = true;
        audioStatus.textContent = "Processing audio...";
        audioOutput.replaceChildren();

        try {
            const response = await fetch(
                "http://127.0.0.1:5000/transcribe-audio",
                {
                    method: "POST",
                    body: formData
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message || `Backend returned ${response.status}`
                );
            }

            audioStatus.textContent =
                `Transcription complete — ${data.language || "Selected language"}`;

            const transcriptHeading = document.createElement("h3");
            transcriptHeading.textContent = "Transcript";

            const transcriptText = document.createElement("p");
            transcriptText.textContent = data.transcript || "No transcript returned.";

            audioOutput.append(transcriptHeading, transcriptText);

            if (data.summary) {
                const summaryHeading = document.createElement("h3");
                summaryHeading.textContent = "AI Summary";
                audioOutput.appendChild(summaryHeading);

                const summary = data.summary;

                if (summary.overview) {
                    const overview = document.createElement("p");
                    overview.textContent = summary.overview;
                    audioOutput.appendChild(overview);
                }

                if (Array.isArray(summary.key_points)) {
                    const list = document.createElement("ul");

                    summary.key_points.forEach(point => {
                        const item = document.createElement("li");
                        item.textContent = point;
                        list.appendChild(item);
                    });

                    audioOutput.appendChild(list);
                }

                if (Array.isArray(summary.important_concepts)) {
                    summary.important_concepts.forEach(concept => {
                        const item = document.createElement("p");
                        item.textContent =
                            `${concept.term || "Concept"}: ${concept.meaning || ""}`;
                        audioOutput.appendChild(item);
                    });
                }

                if (summary.takeaway) {
                    const takeaway = document.createElement("p");
                    takeaway.textContent = `Key takeaway: ${summary.takeaway}`;
                    audioOutput.appendChild(takeaway);
                }
            }
        } catch (error) {
            console.error("Audio processing failed:", error);
            audioStatus.textContent =
                `Audio processing failed: ${error.message}`;
        } finally {
            transcribeAudioBtn.disabled = false;
        }
    });
}


// ======================================================
// LIVE MULTILINGUAL SUBTITLES + TRANSLATED SPEECH
// ======================================================

// ======================================================
// LIVE LISTENING + INDEPENDENT SUBTITLES / AI VOICE
// ======================================================
const LIVE_BACKEND_URL = "http://127.0.0.1:5000";
const liveStartBtn = document.getElementById("startLiveSubtitlesBtn");
const liveStopBtn = document.getElementById("stopLiveSubtitlesBtn");
const liveVoiceStartBtn = document.getElementById("startLiveVoiceBtn");
const liveVoiceStopBtn = document.getElementById("stopLiveVoiceBtn");
const liveStatus = document.getElementById("liveSubtitleStatus");
const liveTranscript = document.getElementById("liveTranscript");
const liveIndicator = document.getElementById("liveSubtitleIndicator");
const subtitleLanguageSelect = document.getElementById("subtitleLanguageSelect");
const audioLanguageSelect = document.getElementById("audioLanguageSelect");
const voiceSelect = document.getElementById("voiceSelect");

let liveListeningRunning = false;
let liveVoiceOn = false;

async function saveLiveSettings() {
  const settings = {
    subtitleLanguage: subtitleLanguageSelect?.value || "original",
    audioLanguage: audioLanguageSelect?.value || "none",
    voice: voiceSelect?.value || "Avinash",
    voiceMode: "manual"
  };

  await chrome.storage.local.set({
    youmentorLiveSettings: settings
  });

  await chrome.runtime.sendMessage({
    type: "UPDATE_LIVE_SETTINGS",
    settings
  });
}

async function restoreLiveSettings() {
  const stored = await chrome.storage.local.get("youmentorLiveSettings");
  const settings = stored.youmentorLiveSettings || {};

  if (settings.subtitleLanguage && subtitleLanguageSelect) {
    subtitleLanguageSelect.value = settings.subtitleLanguage;
  }

  if (settings.audioLanguage && audioLanguageSelect) {
    audioLanguageSelect.value = settings.audioLanguage;
  }

  if (settings.voice && voiceSelect) {
    voiceSelect.value = settings.voice;
  }

  await saveLiveSettings();
}

function updateVoiceButtons() {

    const hasVoiceLanguage =
        audioLanguageSelect &&
        audioLanguageSelect.value !== "none";

    if (liveVoiceStartBtn) {
        liveVoiceStartBtn.disabled =
            !hasVoiceLanguage || liveVoiceOn;
    }

    if (liveVoiceStopBtn) {
        liveVoiceStopBtn.disabled = !liveVoiceOn;
    }

    console.log("AI Voice button state:", {
        language: audioLanguageSelect?.value,
        voiceOn: liveVoiceOn,
        startDisabled: liveVoiceStartBtn?.disabled
    });
}
function resetLiveUI(
  message = "Live listening stopped. Subtitles and AI voice are off."
) {
  liveListeningRunning = false;
  liveVoiceOn = false;

  if (liveStartBtn) liveStartBtn.disabled = false;
  if (liveStopBtn) liveStopBtn.disabled = true;
  if (liveIndicator) liveIndicator.textContent = "STOPPED";
  if (liveStatus) liveStatus.textContent = message;

  updateVoiceButtons();
}

restoreLiveSettings()
    .then(() => {
        updateVoiceButtons();
    })
    .catch(error => {
        console.error("Failed to restore live settings:", error);
    });
// Save settings whenever a selection changes.
[subtitleLanguageSelect, audioLanguageSelect, voiceSelect].forEach(element => {
  if (!element) return;

  element.addEventListener("change", async () => {
    await saveLiveSettings();

    if (element === subtitleLanguageSelect && liveListeningRunning) {
      const enabled = subtitleLanguageSelect.value !== "none";

      await chrome.runtime.sendMessage({
        type: "SET_LIVE_SUBTITLES",
        enabled,
        language: subtitleLanguageSelect.value
      });

      liveStatus.textContent = !enabled
        ? (liveVoiceOn
            ? "Listening. Subtitles are off; AI voice is still on."
            : "Listening. Subtitles and AI voice are off.")
        : (liveVoiceOn
            ? "Listening with subtitles and AI voice."
            : "Listening with subtitles. AI voice is off.");
    }

    if (
      element === audioLanguageSelect &&
      audioLanguageSelect.value === "none" &&
      liveVoiceOn
    ) {
      await chrome.runtime.sendMessage({
        type: "SET_LIVE_VOICE",
        enabled: false
      });

      liveVoiceOn = false;
      liveStatus.textContent = "AI voice stopped. Live listening continues.";
    }

    updateVoiceButtons();
  });
});

// Start listening to the YouTube tab.
if (liveStartBtn) {
  liveStartBtn.textContent = "▶ Start Live Listening";

  liveStartBtn.addEventListener("click", async () => {
    try {
      const tab = await getCurrentVideo();

      await saveLiveSettings();

      liveStartBtn.disabled = true;
      liveStatus.textContent = "Starting live listening...";

      const result = await chrome.runtime.sendMessage({
        type: "START_LIVE_SUBTITLES",
        tabId: tab.id
      });

      if (!result?.success) {
        throw new Error(
          result?.message || "Could not start live listening."
        );
      }

      liveListeningRunning = true;
      liveVoiceOn = false;

      if (liveStopBtn) liveStopBtn.disabled = false;
      if (liveIndicator) liveIndicator.textContent = "LISTENING";

      updateVoiceButtons();

      liveStatus.textContent =
        subtitleLanguageSelect.value === "none"
          ? "Listening. Subtitles are off. Start AI voice whenever you want."
          : "Listening. Subtitles are on; AI voice is optional.";

    } catch (error) {
      resetLiveUI(error.message);
    }
  });
}

// Stop everything: recognition, subtitles and AI voice.
if (liveStopBtn) {
  liveStopBtn.textContent = "■ Stop Everything";
  liveStopBtn.disabled = true;

  liveStopBtn.addEventListener("click", async () => {
    liveStopBtn.disabled = true;
    liveStatus.textContent =
      "Stopping subtitles, AI voice and audio capture...";

    try {
      await chrome.runtime.sendMessage({
        type: "STOP_LIVE_SUBTITLES"
      });
    } finally {
      resetLiveUI();
    }
  });
}


// Start caption-based AI Voice independently.
if (liveVoiceStartBtn) {
    liveVoiceStartBtn.addEventListener("click", async () => {
        try {
            if (
                !audioLanguageSelect ||
                audioLanguageSelect.value === "none"
            ) {
                liveStatus.textContent =
                    "Choose an AI voice language first.";
                return;
            }

            const tab = await getCurrentVideo();

            await saveLiveSettings();

            liveVoiceStartBtn.disabled = true;

            liveStatus.textContent =
                "Retrieving original YouTube captions...";

            const result = await chrome.runtime.sendMessage({
                type: "SET_LIVE_VOICE",
                enabled: true,
                tabId: tab.id
            });

            if (!result?.success) {
                throw new Error(
                    result?.message || "Could not start AI Voice."
                );
            }

            liveVoiceOn = true;

            // Caption voice does not start Gnani live listening.
            if (!liveListeningRunning) {
                if (liveIndicator) {
                    liveIndicator.textContent = "AI VOICE";
                }
            }

            if (liveStopBtn) {
                liveStopBtn.disabled = false;
            }

            updateVoiceButtons();

            liveStatus.textContent =
                `Original captions loaded (${result.captionLanguage || "unknown language"}). AI Voice is ready.`;

        } catch (error) {
            liveVoiceOn = false;

            updateVoiceButtons();

            liveStatus.textContent = error.message;

            console.error("Start AI Voice failed:", error);
        }
    });
}

// Stop only AI voice; live listening and subtitles continue.

// Stop only caption-based AI Voice.
if (liveVoiceStopBtn) {
    liveVoiceStopBtn.addEventListener("click", async () => {
        try {
            liveVoiceStopBtn.disabled = true;

            const result = await chrome.runtime.sendMessage({
                type: "SET_LIVE_VOICE",
                enabled: false
            });

            if (!result?.success) {
                throw new Error(
                    result?.message || "Could not stop AI Voice."
                );
            }

            liveVoiceOn = false;

            updateVoiceButtons();

            liveStatus.textContent = liveListeningRunning
                ? "AI Voice is off. Live listening and subtitles continue."
                : "AI Voice stopped.";

            if (!liveListeningRunning && liveIndicator) {
                liveIndicator.textContent = "STOPPED";
            }

        } catch (error) {
            liveStatus.textContent = error.message;
            console.error("Stop AI Voice failed:", error);
        }
    });
}

// Receive live events from the background service worker.
chrome.runtime.onMessage.addListener(message => {

    if (message?.type !== "LIVE_SUBTITLE_UI_EVENT") {
        return;
    }

    const event = message.event || {};
    
    if (event.type === "caption_voice_ready") {
        if (liveStatus) {
            liveStatus.textContent = event.message;
        }
    }

    if (event.type === "ready") {

        liveListeningRunning = true;

        if (liveStartBtn) liveStartBtn.disabled = true;
        if (liveStopBtn) liveStopBtn.disabled = false;
        if (liveIndicator) liveIndicator.textContent = "LISTENING";

        if (liveStatus) {
            liveStatus.textContent =
                event.message || "Live listening is ready.";
        }

        updateVoiceButtons();

    } else if (event.type === "processing") {

        if (liveIndicator) {
            liveIndicator.textContent = "PROCESSING";
        }

    } else if (event.type === "speech_start") {

        if (liveIndicator) {
            liveIndicator.textContent = "SPEAKING";
        }

    } else if (event.type === "transcript") {

        if (liveIndicator) {
            liveIndicator.textContent = "LIVE";
        }

        // Show original transcript only when subtitles are disabled.
        if (
            subtitleLanguageSelect?.value === "none" &&
            event.text
        ) {
            appendTranscript(event.text);
        }

    } else if (event.type === "translated_transcript") {

        // Display translated transcript.
        if (event.text) {
            appendTranscript(event.text);
        }

        if (liveIndicator) {
            liveIndicator.textContent = "TRANSLATED";
        }

    } else if (event.type === "speaker_detected") {

        if (liveStatus) {
            liveStatus.textContent =
                event.message ||
                `Voice assigned to ${event.speakerId}.`;
        }

    } else if (event.type === "stopped") {

        resetLiveUI();

    } else if (event.type === "error") {

        if (liveStatus) {
            liveStatus.textContent =
                event.message || "Live processing error.";
        }

        if (liveIndicator) {
            liveIndicator.textContent = "ERROR";
        }

        if (
            event.message?.includes("WebSocket") ||
            event.message?.includes("connection closed")
        ) {
            resetLiveUI(event.message);
        }
    }
});


// ======================================================
// APPEND TRANSCRIPT WITHOUT DUPLICATE DISPLAY
// ======================================================

function appendTranscript(text) {

    if (!text || !liveTranscript) {
        return;
    }

    const empty =
        "Your recognised and translated speech will appear here.";

    if (liveTranscript.textContent.trim() === empty) {

        liveTranscript.textContent = text;

    } else {

        liveTranscript.textContent += "\n" + text;

    }

    liveTranscript.scrollTop =
        liveTranscript.scrollHeight;
}