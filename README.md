# SiMC Quiz Portal

![License](https://img.shields.io/badge/License-MIT-green) ![Contributions](https://img.shields.io/badge/Contributions-Welcome-blue)

A web application for medical education, featuring subject-based quizzes with
multiple-choice and free-text questions, timed assessments, and a lecturer
dashboard with bulk import and result export.

<img width="2550" height="825" alt="image" src="https://github.com/user-attachments/assets/ed8583ef-da5a-41f0-b8e6-6a16395fa4b1" />



## Overview

<img width="588" height="371" alt="image" src="https://github.com/user-attachments/assets/39f8b4c3-19d0-4337-9fbb-b04c2bfa74d6" />


The application provides two interfaces.

### For students
- Subject-based quizzes with randomized sampling from question pools
- Multiple-choice (auto-graded) and free-text MEQ (lecturer-reviewed) questions
- Configurable countdown timer with warning threshold and auto-submit
- Subject deadlines enforced at quiz start
- Per-subject best-score history for returning students
- Mobile-optimized interface


<img width="396" height="537" alt="image" src="https://github.com/user-attachments/assets/7ce5d100-2764-42f8-abac-d2328286bc39" />



### For lecturers
- Subject and question pool management
- Composite subjects — sample N questions from multiple source pools
- Bulk question import via JSON, with copy-ready prompts for LLM-assisted authoring
- Live results monitoring with filters, pagination, and bulk delete
- MEQ grading workflow for free-text answers
- CSV and PDF export
  

<img width="1012" height="1144" alt="image" src="https://github.com/user-attachments/assets/e0b1bb84-794f-4ad5-8f3a-84b7bb834c09" />


## MEQ support

Modified Essay Questions accept free-text responses. The MCQ portion of a
submission is auto-graded, but MEQ answers are flagged as pending review on
both the student result screen and the lecturer dashboard.

*Online MEQ grading is not yet supported. Program staff can export a
print-ready PDF report and pass it to faculty for offline grading.

| Student view | Lecturer view |
|:---:|:---:|
| <img width="550" alt="Student answering an MEQ free-text question" src="https://github.com/user-attachments/assets/388891b0-0b98-430c-90af-26867ea8008f" /> | <img width="550" alt="Lecturer MEQ grading report" src="https://github.com/user-attachments/assets/7338d941-0361-4608-8bc4-4a9b4e83137e" /> |


## Tech stack

React 18, Vite, Tailwind CSS, Firebase (Anonymous Auth and Cloud Firestore),
lucide-react.

## Architecture

Single-page React application backed by Firestore. Three collections under
`artifacts/{appId}/public/data/`:

- `quiz_subjects` — subject metadata, timer config, source mode, deadline
- `quiz_pool` — question bank (MCQ and MEQ)
- `quiz_results` — student submissions

Reads are minimized: subjects are fetched once per view, questions are queried
by subject, and results are streamed only while the results tab is open (capped
at 5000 most recent submissions).

## Getting started

### Prerequisites

- Node.js 18 or higher
- A Firebase project with Anonymous Authentication and Cloud Firestore enabled
- Firebase CLI for deployment: `npm install -g firebase-tools`

### 1. Clone and install

```bash
git clone https://github.com/gamethnd/SiMC-quiz-webapp.git
cd SiMC-quiz-webapp
npm install
```

### 2. Configure Firebase

Get the web app config from the Firebase Console:

1. Open [console.firebase.google.com](https://console.firebase.google.com)
2. Select your project, then **Project settings** (gear icon)
3. Under **Your apps**, select your web app or register a new one
4. Copy the `firebaseConfig` values

Create `.env.local` from the template and paste the values:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
VITE_FIREBASE_APP_ID=1:1234567890:web:abc123

VITE_LECTURER_PASSCODE=your-passcode-here
```

`VITE_LECTURER_PASSCODE` can be any non-empty string and gates access to the
lecturer dashboard. Students never see it.

### 3. Enable Firebase services

In the Firebase Console:

- **Authentication** → Sign-in method → enable **Anonymous**
- **Firestore Database** → Create database in **production mode**
- **Firestore Rules** → paste the rules from [docs/firestore.rules](docs/firestore.rules)
  and tighten them before any real use

### 4. Run locally

```bash
npm run dev
```

Open http://localhost:5173. Click **Lecturer**, enter the passcode from
`.env.local`, and create your first subject.

## Deployment

```bash
npm run build
firebase login
firebase use --add
firebase deploy
```

The app is served from `dist/` with SPA rewrite. See [firebase.json](firebase.json)
for hosting configuration.

## Project structure

```
src/
  App.jsx           Single-file application (views, state, Firebase I/O)
  ErrorBoundary.jsx
  main.jsx
public/             Static assets
docs/               Screenshots and example Firestore rules
firebase.json       Hosting and SPA rewrite configuration
```

## License

MIT — see [LICENSE](LICENSE).
