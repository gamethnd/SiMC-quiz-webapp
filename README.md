# SIMC Quiz Web Application

<img width="1500" height="469" alt="image" src="https://github.com/user-attachments/assets/6f37f83a-95db-4dd4-9e28-c7c65907521a" />



This repository is a **public demo and portfolio** version of a quiz web application built with React and Firebase.  
It demonstrates a student quiz system with a lecturer management dashboard.

This demo does **not** include any real API keys or secrets.

---

## Overview

<img width="535" height="341" alt="image" src="https://github.com/user-attachments/assets/40e728d0-b453-4bbb-ae73-60b4a68caa6e" />

The application provides two main interfaces:

### Student interface
- Select quiz subjects
- Take subject-based quizzes
- Optional countdown timer with auto-submit
- View quiz results after submission

### Lecturer interface
- Access via lecturer passcode
- Manage subjects and question pools
- Create, edit, and delete questions
- Bulk import questions using JSON
- View quiz results with filtering and pagination
- Export results to CSV

---

## Technology stack

- React
- Firebase Authentication
- Cloud Firestore
- npm

---

## How to run this demo

### 1. Create your own Firebase project

1. Go to Firebase Console
2. Create a new project
3. Enable the following services:
   - Authentication (Anonymous sign-in)
   - Cloud Firestore
4. Create a Web App and copy the Firebase configuration values

---

### 2. Configure the application

Open `App.jsx` and update the **CONFIGURATION ZONE**.

#### Lecturer passcode
Replace the placeholder with your own passcode:

```js
const LECTURER_PASSCODE = "YOUR_LECTURER_PASSCODE";
```

#### Firebase configuration
Replace all placeholder values with your own Firebase API keys:

```js
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

After completing this step, the application is ready to run.

---

### 3. Install dependencies

Run the following command in the project directory:

```bash
npm install
```

---

### 4. Start the development server

Depending on your project setup, use one of the following commands:

```bash
npm run dev
```

or

```bash
npm start
```

---

## Deployment (Firebase Hosting)

### 1. Install Firebase CLI

```bash
npm install -g firebase-tools
```

---

### 2. Login to Firebase

```bash
firebase login
```

---

### 3. Initialize Firebase Hosting

```bash
firebase init
```

During setup:
- Select **Hosting**
- Choose your Firebase project
- Set the build directory (for example: `dist` or `build`)

---

### 4. Build and deploy

```bash
npm run build
firebase deploy
```

---

## Important notes

- This repository is intended for **demo and portfolio** purposes only.
- No real secrets are stored in this repository.
- Firebase client API keys must be provided by the user.
- Proper Firestore security rules should be configured before real-world use.


