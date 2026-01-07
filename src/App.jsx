/* global __initial_auth_token, __firebase_config, __app_id */
import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  limit,
  getDocs,
  where
} from 'firebase/firestore';
import {
  BookOpen,
  CheckCircle,
  User,
  Shield,
  Plus,
  Trash2,
  ChevronDown,
  Save,
  LogOut,
  BarChart,
  RefreshCw,
  AlertTriangle,
  X,
  Upload,
  FileJson,
  Settings,
  Eye,
  Layers,
  FolderPlus,
  Image as ImageIcon,
  Download,
  Pencil,
  Search,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

// --- CONFIGURATION ZONE ---

// 1. SET YOUR PASSWORD HERE
const LECTURER_PASSCODE = "YOUR_LECTURER_PASSCODE";

// 2. FIREBASE CONFIGURATION
// Note: If running locally, replace the "YOUR_API_KEY" block with your real config.
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
      apiKey: "YOUR_API_KEY",
      authDomain: "YOUR_AUTH_DOMAIN",
      projectId: "YOUR_PROJECT_ID",
      storageBucket: "YOUR_STORAGE_BUCKET",
      messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
      appId: "YOUR_APP_ID"
};
// --- END CONFIGURATION ---

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// FIX 1: Sanitize appId to ensure it is a single path segment (no slashes)
const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const appId = rawAppId.replace(new RegExp('[\\\\/.]', 'g'), '_');

const shuffleArray = (array) => {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

const getLetter = (index) => String.fromCharCode(65 + index);

// Simple Rich Text Formatter
const FormattedText = ({ text }) => {
  if (!text) return null;

  // Split by bold (**...**) then italic (*...*)
  // This is a basic parser. For nested or complex markdown, a library is better.
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g);

  return (
    <span>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('*') && part.endsWith('*')) {
          return <em key={i}>{part.slice(1, -1)}</em>;
        }
        return part;
      })}
    </span>
  );
};

export default function App() {
  const [user, setUser] = useState(null); // Teacher auth user
  const [view, setView] = useState('landing');
  const [questionsPool, setQuestionsPool] = useState([]);
  const [subjects, setSubjects] = useState([]); // New: Subjects list
  const [studentResults, setStudentResults] = useState([]);
  const [zoomedImage, setZoomedImage] = useState(null); // New: Zoomed image state

  // Quiz State
  const [studentName, setStudentName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [selectedSubject, setSelectedSubject] = useState(''); // New: Student selected subject
  const [activeQuizQuestions, setActiveQuizQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [finalScore, setFinalScore] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null); // New: Timer state (seconds)
  const [timerActive, setTimerActive] = useState(false); // New: Timer active flag

  // Teacher State
  const [newQuestion, setNewQuestion] = useState({ text: '', options: ['', '', '', '', ''], correctIndex: 0, image: null });
  const [activeSubject, setActiveSubject] = useState(''); // New: Teacher active subject for editing
  const [newSubjectName, setNewSubjectName] = useState(''); // New: For creating subjects
  const [dashTab, setDashTab] = useState('subjects'); // Changed default to subjects
  const [passcodeInput, setPasscodeInput] = useState('');
  const [rememberPasscode, setRememberPasscode] = useState(false); // New: Remember passcode state
  const [importJson, setImportJson] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false); // New: Delete modal visibility
  const [questionToDelete, setQuestionToDelete] = useState(null); // New: Question to delete

  const [settingLimit, setSettingLimit] = useState(20); // Local state for settings input
  const [settingSourceMode, setSettingSourceMode] = useState('own'); // New: 'own' | 'composite'
  const [settingCompositeConfig, setSettingCompositeConfig] = useState([]); // New: Array of { id, count }
  const [settingTimerEnabled, setSettingTimerEnabled] = useState(false); // New: Timer enabled state
  const [settingTimeMin, setSettingTimeMin] = useState(30); // New: Time limit minutes
  const [settingTimeSec, setSettingTimeSec] = useState(0); // New: Time limit seconds
  const [settingWarningMin, setSettingWarningMin] = useState(1); // New: Warning time minutes
  const [settingWarningSec, setSettingWarningSec] = useState(0); // New: Warning time seconds
  const [activeWarningTime, setActiveWarningTime] = useState(60); // New: Active warning time for quiz
  const [settingsSubject, setSettingsSubject] = useState(''); // New: Subject selected in Settings tab
  const [movingQuestionId, setMovingQuestionId] = useState(null); // New: State for moving question
  const [editingQuestionId, setEditingQuestionId] = useState(null); // New: State for editing question
  const [subjectSearchTerm, setSubjectSearchTerm] = useState(''); // New: Subject search
  const [studentSubjectSearch, setStudentSubjectSearch] = useState(''); // New: Student subject search
  const [showStudentSearchList, setShowStudentSearchList] = useState(false); // New: Control visibility of search list
  const [questionSearchTerm, setQuestionSearchTerm] = useState(''); // New: Question search term
  const [resultSubjectSearch, setResultSubjectSearch] = useState('All Subjects'); // New: Result subject search
  const [showResultSearchList, setShowResultSearchList] = useState(false); // New: Control visibility of result search list
  const [subjectSortOrder, setSubjectSortOrder] = useState('name_asc'); // New: Subject sort order
  const [questionCurrentPage, setQuestionCurrentPage] = useState(1); // New: Question pagination current page
  const [questionItemsPerPage, setQuestionItemsPerPage] = useState(10); // New: Question pagination items per page

  // UI State
  const [configError, setConfigError] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false); // New: Exit modal state
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedResult, setSelectedResult] = useState(null); // For detail view
  const [selectedResultIds, setSelectedResultIds] = useState(new Set()); // For bulk delete
  const [resultToDelete, setResultToDelete] = useState(null); // New: Result deletion state
  const [resultFilterSubject, setResultFilterSubject] = useState('all'); // New: Result filter state
  const [resultFilterDate, setResultFilterDate] = useState(''); // New: Result filter date
  const [resultCurrentPage, setResultCurrentPage] = useState(1); // New: Pagination current page
  const [resultItemsPerPage, setResultItemsPerPage] = useState(10); // New: Pagination items per page
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), notification.duration || 3000); // Reduced to 3s
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // --- PAGINATION & FILTER LOGIC ---
  const filteredResults = React.useMemo(() => {
    return studentResults.filter(r => {
      const matchSubject = resultFilterSubject === 'all' || r.subjectId === resultFilterSubject;
      const matchDate = !resultFilterDate || (() => {
        const d = r.timestamp?.toDate();
        if (!d) return false;
        const localYMD = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return localYMD === resultFilterDate;
      })();
      return matchSubject && matchDate;
    });
  }, [studentResults, resultFilterSubject, resultFilterDate]);

  // Reset page when filters change
  useEffect(() => {
    setResultCurrentPage(1);
  }, [resultFilterSubject, resultFilterDate]);

  const paginatedResults = React.useMemo(() => {
    const start = (resultCurrentPage - 1) * resultItemsPerPage;
    return filteredResults.slice(start, start + resultItemsPerPage);
  }, [filteredResults, resultCurrentPage, resultItemsPerPage]);

  const totalPages = Math.ceil(filteredResults.length / resultItemsPerPage);

  // Clear notification on view change
  useEffect(() => {
    setNotification(null);
  }, [view]);

  useEffect(() => {
    if (firebaseConfig.apiKey === "YOUR_API_KEY") {
      setConfigError(true);
      return;
    }

    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth Error:", error);
        setNotification({ type: 'error', message: "Authentication failed." });
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Don't fetch if just on landing page to save reads
    if (!user || view === 'landing') return;

    // Use sanitized appId in paths
    const fetchInitialData = async () => {
      try {
        const subjectsCollection = collection(db, 'artifacts', appId, 'public', 'data', 'quiz_subjects');

        // Always fetch subjects when entering the app
        const subjectsSnap = await getDocs(query(subjectsCollection, orderBy('createdAt', 'asc')));
        const subs = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setSubjects(subs);
        if (subs.length > 0 && !activeSubject) setActiveSubject(subs[0].id);

        // Only fetch full question pool if in teacher dashboard
        // OPTIMIZATION: Removed to fetch by subject instead
        // if (view === 'teacher-dash') {
        //   const poolCollection = collection(db, 'artifacts', appId, 'public', 'data', 'quiz_pool');
        //   const poolSnap = await getDocs(query(poolCollection));
        //   setQuestionsPool(poolSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        // }
      } catch (err) {
        console.error("Initial Data Error:", err);
      }
    };

    fetchInitialData();

    // No cleanup needed for getDocs
  }, [user, view]);

  // Fetch questions for active subject (Teacher Optimization)
  useEffect(() => {
    if (view !== 'teacher-dash' || !activeSubject) {
      // Optional: Clear questions if no subject selected to save memory/confusion
      // setQuestionsPool([]); 
      return;
    }

    const fetchSubjectQuestions = async () => {
      try {
        const q = query(
          collection(db, 'artifacts', appId, 'public', 'data', 'quiz_pool'),
          where('subjectId', '==', activeSubject)
        );
        const snapshot = await getDocs(q);
        setQuestionsPool(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Error loading questions:", err);
        setNotification({ type: 'error', message: "Failed to load questions." });
      }
    };

    fetchSubjectQuestions();
  }, [view, activeSubject]);

  // Separate effect for results to optimize reads
  useEffect(() => {
    if (!user || view !== 'teacher-dash' || dashTab !== 'results') return;

    const resultsCollection = collection(db, 'artifacts', appId, 'public', 'data', 'quiz_results');
    // Limit to 100 recent results for initial load
    const rQuery = query(resultsCollection, orderBy('timestamp', 'desc'), limit(5000));

    const unsubR = onSnapshot(rQuery, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      // No need to sort again as query is ordered
      setStudentResults(data);
    }, (err) => console.error("Results Error:", err));

    return () => unsubR();
  }, [user, view, dashTab]);

  // Sync settings when settingsSubject changes
  useEffect(() => {
    if (settingsSubject) {
      const sub = subjects.find(s => s.id === settingsSubject);
      if (sub) {
        setSettingLimit(sub.sampleSize || 20);
        setSettingSourceMode(sub.sourceMode || 'own');
        setSettingCompositeConfig(sub.compositeConfig || []);
        setSettingTimerEnabled(sub.timerEnabled || false);

        // Load time limit (handle legacy minutes vs new seconds)
        if (sub.timeLimitSeconds !== undefined) {
          setSettingTimeMin(Math.floor(sub.timeLimitSeconds / 60));
          setSettingTimeSec(sub.timeLimitSeconds % 60);
        } else {
          setSettingTimeMin(sub.timeLimit || 30);
          setSettingTimeSec(0);
        }

        const wTime = sub.warningTime || 60;
        setSettingWarningMin(Math.floor(wTime / 60));
        setSettingWarningSec(wTime % 60);
      }
    } else if (subjects.length > 0) {
      setSettingsSubject(subjects[0].id);
    }
  }, [settingsSubject, subjects, view]);

  // Clear new question form when active subject changes
  useEffect(() => {
    setNewQuestion({ text: '', options: ['', '', '', '', ''], correctIndex: 0, image: null });
    setEditingQuestionId(null);
  }, [activeSubject]);

  // Effect: Sync student search and selection
  useEffect(() => {
    if (view !== 'student-login') return;

    const filtered = subjects.filter(s => s.name.toLowerCase().includes(studentSubjectSearch.toLowerCase()));

    if (filtered.length === 1) {
      if (selectedSubject !== filtered[0].id) setSelectedSubject(filtered[0].id);
    } else if (selectedSubject && !filtered.find(s => s.id === selectedSubject)) {
      setSelectedSubject('');
    }
  }, [studentSubjectSearch, subjects, selectedSubject, view]);

  // Ref for click outside
  const searchRef = useRef(null);
  const resultSearchRef = useRef(null);
  const latestResultFilterSubject = useRef(resultFilterSubject);

  useEffect(() => {
    latestResultFilterSubject.current = resultFilterSubject;
  }, [resultFilterSubject]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowStudentSearchList(false);
      }
      if (resultSearchRef.current && !resultSearchRef.current.contains(event.target)) {
        setShowResultSearchList(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load saved passcode
  useEffect(() => {
    const savedPasscode = localStorage.getItem('lecturerPasscode');
    if (savedPasscode) {
      setPasscodeInput(savedPasscode);
      setRememberPasscode(true);
    }
  }, []);

  // Timer Logic
  useEffect(() => {
    if (view !== 'quiz') return; // Fix: Stop timer if not in quiz view
    if (!timerActive || timeLeft === null) return;

    if (timeLeft === 0) {
      setTimerActive(false);
      setNotification({ type: 'error', message: "Time's up! Submitting quiz..." });
      confirmSubmit();
      return;
    }

    if (timeLeft === activeWarningTime) {
      const formatWarningTime = (totalSeconds) => {
        const m = Math.floor(totalSeconds / 60);
        const s = totalSeconds % 60;
        if (m > 0 && s > 0) return `${m} min ${s} sec`;
        if (m > 0) return `${m} min`;
        return `${s} sec`;
      };
      setNotification({ type: 'warning', message: `⚠️ ${formatWarningTime(activeWarningTime)} Remaining!`, duration: 5000 });
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timerActive, timeLeft, view]);

  // --- ACTIONS ---

  const startQuiz = async () => {
    if (!studentName || !studentId || !selectedSubject) {
      setNotification({ type: 'error', message: "Please fill in all fields." });
      return;
    }

    // 1. Get Subject Settings
    const subjectData = subjects.find(s => s.id === selectedSubject);
    const limit = subjectData?.sampleSize || 20;

    // 2. Fetch Questions Logic (Composite Support)
    let finalQuestions = [];

    // Mode: Composite
    if (subjectData?.sourceMode === 'composite' && subjectData.compositeConfig?.length > 0) {
      try {
        const promises = subjectData.compositeConfig.map(async (source) => {
          const q = query(
            collection(db, 'artifacts', appId, 'public', 'data', 'quiz_pool'),
            where('subjectId', '==', source.id)
          );
          const snapshot = await getDocs(q);
          let rawQuestions = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

          // Filter valid
          rawQuestions = rawQuestions.filter(q => q.text && q.options && q.options.length > 0);

          // Deduplicate
          rawQuestions = Array.from(new Map(rawQuestions.map(item => [item.text, item])).values());

          // Shuffle and take specific count
          return shuffleArray(rawQuestions).slice(0, source.count);
        });

        const results = await Promise.all(promises);
        results.forEach(batch => {
          finalQuestions = [...finalQuestions, ...batch];
        });

      } catch (error) {
        console.error("Fetch Composite Error:", error);
        setNotification({ type: 'error', message: "Failed to load composite quiz." });
        return;
      }
    }
    // Mode: Own (Default)
    else {
      let subjectQuestions = [];
      try {
        const q = query(
          collection(db, 'artifacts', appId, 'public', 'data', 'quiz_pool'),
          where('subjectId', '==', selectedSubject)
        );
        const snapshot = await getDocs(q);
        subjectQuestions = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (error) {
        console.error("Fetch Quiz Error:", error);
        setNotification({ type: 'error', message: "Failed to load quiz." });
        return;
      }

      // Filter valid
      subjectQuestions = subjectQuestions.filter(q => q.text && q.options && q.options.length > 0);

      // Deduplicate
      const uniquePool = Array.from(new Map(subjectQuestions.map(item => [item.text, item])).values());

      // Shuffle here, slice later
      finalQuestions = shuffleArray(uniquePool);
    }

    if (finalQuestions.length === 0) {
      setNotification({ type: 'error', message: "No questions found!" });
      return;
    }

    // 3. Final Shuffle and Limit
    // In composite mode, we already limited per source, but we shuffle again to mix them.
    // We also respect the global limit as a "hard cap" if set lower than sum of parts.
    setActiveQuizQuestions(shuffleArray(finalQuestions).slice(0, limit));

    // FIX: Reset quiz state for new session
    setAnswers({});
    setFinalScore(null);
    setIsSubmitting(false);

    // Initialize Timer
    if (subjectData?.timerEnabled) {
      // Use seconds if available, otherwise fallback to minutes * 60
      const duration = subjectData.timeLimitSeconds !== undefined
        ? subjectData.timeLimitSeconds
        : (subjectData.timeLimit || 30) * 60;

      setTimeLeft(duration);
      setActiveWarningTime(subjectData.warningTime || 60);
      setTimerActive(true);
    } else {
      setTimeLeft(null);
      setTimerActive(false);
    }

    setView('quiz');
    window.scrollTo(0, 0);
  };

  const saveSettings = async () => {
    if (!settingsSubject) return;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'quiz_subjects', settingsSubject), {
        sampleSize: Number(settingLimit),
        sourceMode: settingSourceMode,
        compositeConfig: settingCompositeConfig,
        timerEnabled: settingTimerEnabled,
        timeLimit: Number(settingTimeMin), // Legacy support
        timeLimitSeconds: (Number(settingTimeMin) * 60) + Number(settingTimeSec), // New precise field
        warningTime: (Number(settingWarningMin) * 60) + Number(settingWarningSec),
        updatedAt: serverTimestamp()
      });
      setNotification({ type: 'success', message: "Settings saved for subject." });
    } catch (e) {
      console.error(e);
      setNotification({ type: 'error', message: "Failed to save settings." });
    }
  };

  const confirmSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setShowSubmitModal(false);
    setIsSubmitting(true);
    try {

      let score = 0;
      activeQuizQuestions.forEach(q => { if (answers[q.id] === q.correctIndex) score++; });

      // Save full history for detailed review
      const history = activeQuizQuestions.map(q => ({
        id: q.id,
        text: q.text,
        image: q.image || null,
        options: q.options,
        correctIndex: q.correctIndex,
        userAnswer: answers[q.id] !== undefined ? answers[q.id] : null,
        subjectId: q.subjectId // Fix: Save subjectId for history lookup
      }));

      const subjectName = subjects.find(s => s.id === selectedSubject)?.name || 'Unknown Subject';

      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'quiz_results'), {
        studentName, studentId, score,
        totalQuestions: activeQuizQuestions.length,
        answers,
        history,
        subjectId: selectedSubject,
        subjectName,
        timestamp: serverTimestamp()
      });
      setFinalScore(score);
      setView('result');
    } catch (error) {
      setNotification({ type: 'error', message: `Failed: ${error.message}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddQuestion = async () => {
    if (!newQuestion.text || newQuestion.options.some(o => !o)) {
      setNotification({ type: 'error', message: "Incomplete fields." });
      return;
    }
    if (!activeSubject) {
      setNotification({ type: 'error', message: "Select a subject first." });
      return;
    }
    const docRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'quiz_pool'), {
      ...newQuestion,
      subjectId: activeSubject,
      createdAt: serverTimestamp()
    });
    // Manual state update
    const newQ = { id: docRef.id, ...newQuestion, subjectId: activeSubject, createdAt: { seconds: Date.now() / 1000 } };
    setQuestionsPool([...questionsPool, newQ]);
    setNewQuestion({ text: '', options: ['', '', '', '', ''], correctIndex: 0, image: null });
    setNotification({ type: 'success', message: "Saved." });
  };

  const handleEditQuestion = (question) => {
    setEditingQuestionId(question.id);
    setNewQuestion({
      text: question.text,
      options: [...question.options],
      correctIndex: question.correctIndex,
      image: question.image || null
    });
    // Scroll to top of form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUpdateQuestion = async () => {
    if (!editingQuestionId) return;
    if (!newQuestion.text || newQuestion.options.some(o => !o)) {
      setNotification({ type: 'error', message: "Incomplete fields." });
      return;
    }

    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'quiz_pool', editingQuestionId), {
        ...newQuestion,
        updatedAt: serverTimestamp()
      });

      // Manual state update
      setQuestionsPool(questionsPool.map(q =>
        q.id === editingQuestionId ? { ...q, ...newQuestion, updatedAt: { seconds: Date.now() / 1000 } } : q
      ));

      setNewQuestion({ text: '', options: ['', '', '', '', ''], correctIndex: 0, image: null });
      setEditingQuestionId(null);
      setNotification({ type: 'success', message: "Question updated successfully." });
    } catch (error) {
      console.error("Update Error:", error);
      setNotification({ type: 'error', message: "Failed to update question." });
    }
  };

  const handleCancelEdit = () => {
    setNewQuestion({ text: '', options: ['', '', '', '', ''], correctIndex: 0, image: null });
    setEditingQuestionId(null);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      // If file size is < 800KB, use original
      if (file.size < 800 * 1024) {
        setNewQuestion({ ...newQuestion, image: event.target.result });
        return;
      }

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const MAX_WIDTH = 2500; // Increased to 2500 for high quality

        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 1.0); // Max quality
        setNewQuestion({ ...newQuestion, image: dataUrl });
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleBulkImport = async () => {
    try {
      const parsed = JSON.parse(importJson);
      if (!Array.isArray(parsed)) throw new Error("Data must be an array");

      const promises = parsed.map(q => {
        if (!q.text || !q.options || q.correctIndex === undefined) return null;
        return addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'quiz_pool'), {
          ...q,
          subjectId: activeSubject,
          createdAt: serverTimestamp()
        });
      });

      await Promise.all(promises.filter(p => p !== null));

      setImportJson('');
      setShowImportModal(false);
      setNotification({ type: 'success', message: `Imported ${parsed.length} questions successfully.` });
    } catch (error) {
      console.error("Import Error:", error);
      setNotification({ type: 'error', message: "Invalid JSON format. Check your input." });
    }
  };

  const handleDeleteQuestion = (id) => {
    setQuestionToDelete(id);
    setShowDeleteModal(true);
  };

  const confirmDeleteQuestion = async () => {
    if (!questionToDelete) return;

    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'quiz_pool', questionToDelete));
      // Manual state update
      setQuestionsPool(questionsPool.filter(q => q.id !== questionToDelete));
      setNotification({ type: 'success', message: "Question deleted." });
    } catch (error) {
      console.error("Delete Error:", error);
      setNotification({ type: 'error', message: "Failed to delete question." });
    } finally {
      setShowDeleteModal(false);
      setQuestionToDelete(null);
    }
  };

  const handleMoveQuestion = async (questionId, newSubjectId) => {
    if (!newSubjectId) return;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'quiz_pool', questionId), {
        subjectId: newSubjectId,
        updatedAt: serverTimestamp()
      });
      setMovingQuestionId(null);
      setNotification({ type: 'success', message: "Question moved successfully." });
    } catch (error) {
      console.error("Move Error:", error);
      setNotification({ type: 'error', message: "Failed to move question." });
    }
  };

  const handleDeleteResult = (id) => {
    setResultToDelete(id);
    setShowDeleteModal(true);
  };

  const confirmDeleteResult = async () => {
    if (!resultToDelete) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'quiz_results', resultToDelete));
      setNotification({ type: 'success', message: "Result deleted." });
    } catch (error) {
      console.error("Delete Error:", error);
      setNotification({ type: 'error', message: "Failed to delete result." });
    } finally {
      setShowDeleteModal(false);
      setResultToDelete(null);
    }
  };

  const handleBulkDeleteResults = async () => {
    if (selectedResultIds.size === 0) return;
    if (!confirm(`Delete ${selectedResultIds.size} selected results?`)) return;

    try {
      const promises = Array.from(selectedResultIds).map(id =>
        deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'quiz_results', id))
      );
      await Promise.all(promises);
      setSelectedResultIds(new Set());
      setNotification({ type: 'success', message: "Results deleted." });
    } catch (error) {
      console.error("Bulk Delete Error:", error);
      setNotification({ type: 'error', message: "Failed to delete results." });
    }
  };

  const toggleResultSelection = (id) => {
    const newSet = new Set(selectedResultIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedResultIds(newSet);
  };

  const toggleSelectAllResults = () => {
    if (selectedResultIds.size === filteredResults.length && filteredResults.length > 0) {
      setSelectedResultIds(new Set());
    } else {
      setSelectedResultIds(new Set(filteredResults.map(r => r.id)));
    }
  };

  const handleExportCSV = async () => {
    let dataToExport = [];
    try {
      const resultsCollection = collection(db, 'artifacts', appId, 'public', 'data', 'quiz_results');
      const q = query(resultsCollection, orderBy('timestamp', 'desc'));
      const snapshot = await getDocs(q);
      dataToExport = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (error) {
      console.error("Export Error:", error);
      setNotification({ type: 'error', message: "Failed to fetch data for export." });
      return;
    }

    const filtered = dataToExport.filter(r => {
      const matchSubject = resultFilterSubject === 'all' || r.subjectId === resultFilterSubject;
      const matchDate = !resultFilterDate || (() => {
        const d = r.timestamp?.toDate();
        if (!d) return false;
        const localYMD = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return localYMD === resultFilterDate;
      })();
      return matchSubject && matchDate;
    });

    if (filtered.length === 0) {
      setNotification({ type: 'error', message: "No results to export." });
      return;
    }

    const headers = ["Student Name", "Student ID", "Subject", "Score", "Total Questions", "Date"];
    const rows = filtered.map(r => [
      `"${r.studentName}"`,
      `"${r.studentId}"`,
      `"${r.subjectName || 'Unknown'}"`,
      r.score,
      r.totalQuestions,
      `"${r.timestamp?.toDate().toLocaleString('en-GB')}"`
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `quiz_results_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCreateSubject = async () => {
    if (!newSubjectName.trim()) return;
    const docRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'quiz_subjects'), {
      name: newSubjectName,
      createdAt: serverTimestamp()
    });
    // Manual state update
    const newSub = { id: docRef.id, name: newSubjectName, createdAt: { seconds: Date.now() / 1000 } };
    setSubjects([...subjects, newSub]);
    setNewSubjectName('');
    setNotification({ type: 'success', message: "Subject created." });
  };

  const handleDeleteSubject = async (id) => {
    if (confirm("Delete Subject? Questions will remain but be hidden.")) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'quiz_subjects', id));
      // Manual state update
      setSubjects(subjects.filter(s => s.id !== id));
      if (activeSubject === id) setActiveSubject('');
    }
  };

  // --- UI COMPONENTS ---

  const NotificationToast = () => {
    if (!notification) return null;

    if (notification.type === 'warning') {
      return (
        <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[100] p-6 rounded-2xl shadow-2xl flex flex-col items-center gap-4 text-white font-bold text-xl bg-amber-500 w-96 text-center border-4 border-white/20 backdrop-blur-sm">
          <AlertTriangle className="w-10 h-10 animate-pulse" />
          {String(notification.message)}
        </div>
      );
    }

    return (
      <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 text-white font-medium ${notification.type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>
        {notification.type === 'error' ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
        {/* FIX 2: Ensure message is always a string to prevent React crashes */}
        {String(notification.message)}
      </div>
    );
  };

  const ImportModal = () => {
    if (!showImportModal) return null;
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><FileJson /> Bulk Import JSON</h3>
            <button onClick={() => setShowImportModal(false)}><X className="text-slate-400 hover:text-slate-600" /></button>
          </div>
          <p className="text-sm text-slate-500 mb-2">Paste the JSON array provided by the AI here.</p>
          <textarea
            className="w-full h-64 p-3 border border-slate-300 rounded-lg font-mono text-xs mb-4 focus:ring-2 focus:ring-indigo-500 outline-none"
            placeholder='[{"text": "Question?", "options": ["A", "B", "C", "D"], "correctIndex": 0}, ...]'
            value={importJson}
            onChange={e => setImportJson(e.target.value)}
          />
          <div className="flex justify-end gap-3">
            <button onClick={() => setShowImportModal(false)} className="px-4 py-2 text-slate-600 font-bold">Cancel</button>
            <button onClick={handleBulkImport} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700">Import Questions</button>
          </div>
        </div>
      </div>
    );
  };

  const ImageModal = () => {
    if (!zoomedImage) return null;
    return (
      <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4 cursor-zoom-out" onClick={() => setZoomedImage(null)}>
        <img src={zoomedImage} alt="Zoomed" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
        <button className="absolute top-4 right-4 text-white bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors">
          <X size={24} />
        </button>
      </div>
    );
  };

  const ExitModal = () => {
    if (!showExitModal) return null;
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
          <h3 className="text-xl font-bold text-slate-800 mb-2">Exit Quiz?</h3>
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3 items-start">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-800">Are you sure you want to exit?</p>
              <p className="text-sm text-amber-700">Your progress will be lost.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowExitModal(false)} className="flex-1 py-3 px-4 rounded-xl border border-slate-200 font-bold hover:bg-slate-50">Cancel</button>
            <button onClick={() => { setView('landing'); setShowExitModal(false); }} className="flex-1 py-3 px-4 rounded-xl bg-red-600 text-white font-bold shadow-lg hover:bg-red-700">Exit Quiz</button>
          </div>
        </div>
      </div>
    );
  };

  const ConfirmDeleteModal = () => {
    if (!showDeleteModal) return null;

    const isResult = !!resultToDelete;
    const title = isResult ? "Delete Result?" : "Delete Question?";
    const msg = isResult ? "This result and its history will be permanently removed." : "This action cannot be undone.";

    const handleConfirm = () => {
      if (isResult) confirmDeleteResult();
      else confirmDeleteQuestion();
    };

    const handleCancel = () => {
      setShowDeleteModal(false);
      setResultToDelete(null);
      setQuestionToDelete(null);
    };

    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
          <h3 className="text-xl font-bold text-slate-800 mb-2">{title}</h3>
          <p className="text-slate-600 mb-6">{msg}</p>
          <div className="flex gap-3">
            <button onClick={handleCancel} className="flex-1 py-3 px-4 rounded-xl border border-slate-200 font-bold hover:bg-slate-50">Cancel</button>
            <button onClick={handleConfirm} className="flex-1 py-3 px-4 rounded-xl bg-red-600 text-white font-bold shadow-lg hover:bg-red-700">Delete</button>
          </div>
        </div>
      </div>
    );
  };

  const ResultDetailModal = () => {
    if (!selectedResult) return null;
    const { studentName, studentId, score, totalQuestions, history } = selectedResult;

    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full p-6 max-h-[90vh] flex flex-col">
          <div className="flex justify-between items-center mb-4 border-b pb-4">
            <div>
              <h3 className="text-xl font-bold text-slate-800">{studentName} <span className="text-slate-500 text-sm">({studentId})</span></h3>
              <p className="text-indigo-600 font-bold">Score: {score} / {totalQuestions}</p>
            </div>
            <button onClick={() => setSelectedResult(null)}><X className="text-slate-400 hover:text-slate-600" /></button>
          </div>

          <div className="overflow-y-auto flex-1 space-y-4 pr-2">
            {!history ? (
              <div className="text-center text-slate-400 py-10 italic">Detailed history not available for this result.</div>
            ) : (
              <div className="flex-1 overflow-y-auto p-1">
                {history.map((q, i) => {
                  const isUnanswered = q.userAnswer === null;
                  const isCorrect = q.userAnswer === q.correctIndex;

                  let cardClass = '';
                  if (isUnanswered) cardClass = 'bg-slate-50 border-slate-200';
                  else if (isCorrect) cardClass = 'bg-green-50 border-green-200';
                  else cardClass = 'bg-red-50 border-red-200';

                  return (
                    <div key={i} className={`p-4 rounded-lg border mb-3 ${cardClass}`}>
                      <div className="flex gap-3 mb-2">
                        <span className="font-bold text-slate-500">{i + 1}.</span>
                        <div className="flex-1">
                          <div className="flex justify-between items-start">
                            <p className="font-semibold text-slate-800"><FormattedText text={q.text} /></p>
                            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded ml-2 whitespace-nowrap">
                              {subjects.find(s => s.id === q.subjectId)?.name || 'Unknown Subject'}
                            </span>
                          </div>
                          {q.image && <img src={q.image} alt="Question" className="max-h-40 rounded-lg mb-2 border cursor-zoom-in hover:opacity-90 transition-opacity" onClick={() => setZoomedImage(q.image)} />}
                        </div>
                      </div>
                      <div className="pl-8 space-y-1">
                        {q.options.map((opt, oi) => {
                          let style = "text-slate-500";
                          if (oi === q.correctIndex) style = "text-green-700 font-bold";
                          if (oi === q.userAnswer && !isCorrect) style = "text-red-600 font-bold line-through";

                          return (
                            <div key={oi} className={`text-sm flex gap-2 ${style}`}>
                              <span>{getLetter(oi)}.</span>
                              <span>{opt}</span>
                              {oi === q.correctIndex && <CheckCircle className="w-4 h-4 inline" />}
                              {oi === q.userAnswer && !isCorrect && <X className="w-4 h-4 inline" />}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };




  // --- QUESTION PAGINATION LOGIC ---
  const filteredQuestions = React.useMemo(() => {
    return questionsPool.filter(q => q.subjectId === activeSubject && q.text.toLowerCase().includes(questionSearchTerm.toLowerCase()));
  }, [questionsPool, activeSubject, questionSearchTerm]);

  // Reset page when filters change
  useEffect(() => {
    setQuestionCurrentPage(1);
  }, [activeSubject, questionSearchTerm]);

  const paginatedQuestions = React.useMemo(() => {
    const start = (questionCurrentPage - 1) * questionItemsPerPage;
    return filteredQuestions.slice(start, start + questionItemsPerPage);
  }, [filteredQuestions, questionCurrentPage, questionItemsPerPage]);

  const totalQuestionPages = Math.ceil(filteredQuestions.length / questionItemsPerPage);


  // --- VIEWS ---

  if (configError) return <div className="min-h-screen flex items-center justify-center bg-red-50 p-4 text-red-600 font-bold">Error: Missing Firebase API KEY in App.jsx</div>;

  // Allow landing page to render while connecting
  if (!user && view !== 'landing') {
    return <div className="h-screen flex items-center justify-center text-slate-500">Connecting...</div>;
  }

  return (
    <div className="font-sans text-slate-800">
      <ResultDetailModal />
      <ImportModal />
      <ImageModal />
      <ExitModal />
      <NotificationToast />
      <ConfirmDeleteModal />

      {/* Submit Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-slate-800 mb-2">Submit Quiz?</h3>

            {/* Unanswered Warning */}
            <div className="mb-4">
              {Object.keys(answers).length < activeQuizQuestions.length ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-3 items-start">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-amber-800">You have unanswered questions!</p>
                    <p className="text-sm text-amber-700 mb-2">
                      You answered <span className="font-bold">{Object.keys(answers).length}</span> out of <span className="font-bold">{activeQuizQuestions.length}</span>.
                    </p>
                    <p className="text-xs text-amber-800 font-bold">
                      Missing: {activeQuizQuestions
                        .map((q, i) => answers[q.id] === undefined ? i + 1 : null)
                        .filter(i => i !== null)
                        .join(', ')}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-slate-600">Are you sure you want to submit your answers?</p>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowSubmitModal(false)} className="flex-1 py-3 px-4 rounded-xl border border-slate-200 font-bold">Cancel</button>
              <button onClick={confirmSubmit} className="flex-1 py-3 px-4 rounded-xl bg-blue-600 text-white font-bold shadow-lg">Yes, Submit</button>
            </div>
          </div>
        </div>
      )}

      {view === 'landing' && (
        <div className="h-screen flex items-center justify-center bg-slate-50">
          <div className="bg-white p-8 rounded-xl shadow-lg w-96 space-y-4">
            <h1 className="text-2xl font-bold text-center">SIMC Quiz Portal</h1>
            <button onClick={() => setView('student-login')} className="w-full p-4 bg-blue-600 text-white rounded-lg flex items-center justify-center gap-2 font-bold"><User /> Student</button>
            <button onClick={() => setView('teacher-auth')} className="w-full p-4 border-2 hover:bg-slate-50 rounded-lg flex items-center justify-center gap-2 font-bold"><Shield /> Lecturer</button>
          </div>
        </div>
      )}

      {view === 'teacher-auth' && (
        <div className="h-screen flex items-center justify-center bg-slate-50">
          <div className="bg-white p-8 rounded-xl shadow-lg w-80">
            <button onClick={() => setView('landing')} className="text-sm text-slate-400 mb-4">Back</button>
            <h2 className="text-xl font-bold mb-4">Lecturer Access</h2>
            <input
              type="password"
              placeholder="Passcode"
              className="w-full p-3 border rounded-lg mb-4"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (passcodeInput === LECTURER_PASSCODE) {
                    if (rememberPasscode) {
                      localStorage.setItem('lecturerPasscode', passcodeInput);
                    } else {
                      localStorage.removeItem('lecturerPasscode');
                    }
                    setView('teacher-dash');
                    if (!rememberPasscode) setPasscodeInput('');
                  } else {
                    setNotification({ type: 'error', message: 'Wrong Passcode' });
                  }
                }
              }}
              value={passcodeInput}
              onChange={e => setPasscodeInput(e.target.value)}
            />
            <div className="flex items-center mb-4">
              <input
                type="checkbox"
                id="rememberPasscode"
                className="mr-2 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                checked={rememberPasscode}
                onChange={(e) => setRememberPasscode(e.target.checked)}
              />
              <label htmlFor="rememberPasscode" className="text-sm text-slate-600">Remember Passcode</label>
            </div>
            <button
              onClick={() => {
                if (passcodeInput === LECTURER_PASSCODE) {
                  if (rememberPasscode) {
                    localStorage.setItem('lecturerPasscode', passcodeInput);
                  } else {
                    localStorage.removeItem('lecturerPasscode');
                  }
                  setView('teacher-dash');
                  if (!rememberPasscode) setPasscodeInput('');
                } else {
                  setNotification({ type: 'error', message: 'Wrong Passcode' });
                }
              }}
              className="w-full bg-indigo-600 text-white p-3 rounded-lg font-bold"
            >
              Enter
            </button>
          </div>
        </div>
      )}

      {view === 'student-login' && (
        <div className="h-screen flex items-center justify-center bg-slate-50">
          <div className="bg-white p-8 rounded-xl shadow-lg w-96">
            <button onClick={() => setView('landing')} className="text-sm mb-4 text-slate-400">Back</button>
            <h2 className="text-xl font-bold mb-6">Student Login</h2>
            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-500 mb-1">Select Subject</label>
              <div className="relative mb-2" ref={searchRef}>
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <input
                  className="w-full pl-9 pr-8 py-3 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  placeholder="-- Choose Subject --"
                  value={studentSubjectSearch}
                  onFocus={() => setShowStudentSearchList(true)}
                  onClick={() => setShowStudentSearchList(true)}
                  onChange={e => {
                    setStudentSubjectSearch(e.target.value);
                    setShowStudentSearchList(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const filtered = subjects.filter(s => s.name.toLowerCase().includes(studentSubjectSearch.toLowerCase()));
                      if (filtered.length > 0) {
                        setSelectedSubject(filtered[0].id);
                        setStudentSubjectSearch(filtered[0].name);
                        setShowStudentSearchList(false);
                      }
                    }
                  }}
                />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
                  {studentSubjectSearch && (
                    <button
                      onClick={() => {
                        setStudentSubjectSearch('');
                        setSelectedSubject('');
                        setShowStudentSearchList(true);
                      }}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X size={14} />
                    </button>
                  )}
                  <ChevronDown size={16} className="text-slate-400" />
                </div>

                {showStudentSearchList && (
                  <div className="absolute top-full left-0 right-0 z-50 bg-white border border-slate-200 rounded-lg shadow-2xl mt-1 max-h-60 overflow-y-auto">
                    {subjects.filter(s => s.name.toLowerCase().includes(studentSubjectSearch.toLowerCase())).length > 0 ? (
                      subjects
                        .filter(s => s.name.toLowerCase().includes(studentSubjectSearch.toLowerCase()))
                        .map(s => (
                          <div
                            key={s.id}
                            onClick={() => {
                              setSelectedSubject(s.id);
                              setStudentSubjectSearch(s.name);
                              setShowStudentSearchList(false);
                            }}
                            className={`p-3 cursor-pointer transition-colors border-b last:border-b-0 text-sm ${selectedSubject === s.id ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-slate-50 text-slate-700'}`}
                          >
                            {s.name}
                          </div>
                        ))
                    ) : (
                      <div className="p-4 text-slate-400 italic text-center text-sm">No matches found</div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <input className="w-full p-3 border rounded-lg mb-3" placeholder="Name" value={studentName} onChange={e => setStudentName(e.target.value)} />
            <input className="w-full p-3 border rounded-lg mb-4" placeholder="ID" value={studentId} onChange={e => setStudentId(e.target.value)} />
            <button onClick={startQuiz} className="w-full bg-blue-600 text-white p-3 rounded-lg font-bold">Start Quiz</button>
          </div>
        </div>
      )}

      {view === 'quiz' && (
        <div className="min-h-screen bg-slate-50 pb-20">
          <div className="p-4 bg-white shadow-sm sticky top-0 font-bold flex justify-between items-center z-10 border-b">
            <div>
              {studentName} <span className="text-slate-400 text-xs">({studentId})</span>
              <span className="ml-2 text-indigo-600 text-xs bg-indigo-50 px-2 py-1 rounded">{subjects.find(s => s.id === selectedSubject)?.name}</span>
            </div>
            <div className="flex items-center gap-3">
              {timerActive && timeLeft !== null && (
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-bold ${timeLeft < 60 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-slate-100 text-slate-700'}`}>
                  <span>⏱️</span>
                  <span>{Math.floor(timeLeft / 60).toString().padStart(2, '0')}:{(timeLeft % 60).toString().padStart(2, '0')}</span>
                </div>
              )}
              <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm">{activeQuizQuestions.length} Questions</span>
              <button
                onClick={() => setShowExitModal(true)}
                className="flex items-center gap-2 text-red-600 hover:text-red-700 px-3 py-2 rounded-lg hover:bg-red-50 transition-colors font-bold text-sm"
                title="Exit Quiz"
              >
                <LogOut className="w-4 h-4" />
                Exit
              </button>
            </div>
          </div>
          <div className="max-w-2xl mx-auto p-4 space-y-6 mt-4">
            {activeQuizQuestions.map((q, i) => (
              <div key={q.id} className="bg-white p-6 rounded-xl shadow-sm border">
                <div className="flex gap-3 mb-4"><span className="bg-slate-100 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">{i + 1}</span>
                  <div className="flex-1">
                    {q.image && <img src={q.image} alt="Question" className="max-h-[500px] rounded-lg mb-3 border shadow-sm cursor-zoom-in hover:opacity-90 transition-opacity" onClick={() => setZoomedImage(q.image)} />}
                    <h3 className="font-semibold text-lg pt-0.5"><FormattedText text={q.text} /></h3>
                  </div>
                </div>
                <div className="space-y-2 pl-11">
                  {q.options.map((opt, oi) => (
                    <label key={oi} className={`flex items-center p-3 border rounded-lg cursor-pointer hover:bg-slate-50 ${answers[q.id] === oi ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' : ''}`}>
                      <input
                        type="radio"
                        name={`question-${q.id}`}
                        className="hidden"
                        checked={answers[q.id] === oi}
                        onChange={() => setAnswers({ ...answers, [q.id]: oi })}
                      />
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center mr-3 ${answers[q.id] === oi ? 'border-blue-600' : 'border-slate-400'}`}>{answers[q.id] === oi && <div className="w-2.5 h-2.5 bg-blue-600 rounded-full" />}</div>
                      <span className="font-bold text-slate-500 mr-2 w-5">{getLetter(oi)}.</span>
                      {/* FIX 4: Ensure option is string */}
                      <span>{String(opt)}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <div className="pt-4"><button onClick={() => setShowSubmitModal(true)} disabled={isSubmitting} className="w-full bg-green-600 text-white p-4 rounded-xl font-bold text-lg shadow-lg">{isSubmitting ? '...' : 'Submit Answers'}</button></div>
          </div>
        </div>
      )
      }

      {
        view === 'result' && (
          <div className="h-screen flex items-center justify-center bg-slate-50 p-4">
            <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-sm w-full">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-6" />
              <h2 className="text-2xl font-bold mb-2">Submitted!</h2>
              <div className="bg-slate-50 rounded-xl p-4 mb-6"><div className="text-4xl font-black">{finalScore} <span className="text-xl text-slate-400">/ {activeQuizQuestions.length}</span></div></div>
              <button onClick={() => { setView('landing'); setStudentName(''); setStudentId(''); setFinalScore(null); }} className="w-full bg-slate-800 text-white p-3 rounded-lg font-bold">Home</button>
            </div>
          </div>
        )
      }

      {
        view === 'teacher-dash' && (
          <div className="min-h-screen bg-slate-100">
            <nav className="bg-indigo-700 text-white p-4 flex justify-between items-center shadow-md sticky top-0 z-20">
              <span className="font-bold flex items-center gap-2 text-lg"><BookOpen className="w-6 h-6" /> Dashboard</span>
              <button onClick={() => setView('landing')} className="text-sm bg-indigo-800 hover:bg-indigo-600 px-4 py-2 rounded-lg flex items-center gap-2"><LogOut className="w-4 h-4" /> Exit</button>
            </nav>
            <div className="max-w-5xl mx-auto p-6">
              <div className="flex gap-4 mb-6 overflow-x-auto pb-2">
                <button onClick={() => setDashTab('subjects')} className={`px-4 py-2 rounded-lg font-bold shadow-sm whitespace-nowrap ${dashTab === 'subjects' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600'}`}><Layers className="w-4 h-4 inline mr-1" /> Subjects</button>
                <button onClick={() => setDashTab('questions')} className={`px-4 py-2 rounded-lg font-bold shadow-sm whitespace-nowrap ${dashTab === 'questions' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600'}`}>Questions</button>
                <button onClick={() => setDashTab('results')} className={`px-4 py-2 rounded-lg font-bold shadow-sm whitespace-nowrap ${dashTab === 'results' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600'}`}>Results</button>
                <button onClick={() => setDashTab('settings')} className={`px-4 py-2 rounded-lg font-bold shadow-sm whitespace-nowrap ${dashTab === 'settings' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600'}`}><Settings className="w-4 h-4 inline mr-1" /> Settings</button>
              </div>

              {dashTab === 'subjects' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4"><FolderPlus className="w-5 h-5" /> Create Subject</h3>
                    <div className="flex gap-2">
                      <input
                        className="flex-1 p-3 border rounded-lg"
                        placeholder="Subject Name (e.g. Math 101)"
                        value={newSubjectName}
                        onChange={e => setNewSubjectName(e.target.value)}
                      />
                      <button onClick={handleCreateSubject} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold">Add</button>
                    </div>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[600px]">
                    <div className="p-4 bg-slate-50 border-b flex flex-wrap justify-between items-center gap-4">
                      <span className="font-bold text-slate-500 text-xs uppercase whitespace-nowrap">Existing Subjects</span>
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                          <input
                            className="pl-9 pr-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 w-32 lg:w-48"
                            placeholder="Search subjects..."
                            value={subjectSearchTerm}
                            onChange={e => setSubjectSearchTerm(e.target.value)}
                          />
                        </div>
                        <select
                          value={subjectSortOrder}
                          onChange={(e) => setSubjectSortOrder(e.target.value)}
                          className="p-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-600 font-medium"
                        >
                          <option value="name_asc">Name (A-Z)</option>
                          <option value="name_desc">Name (Z-A)</option>
                          <option value="date_newest">Newest First</option>
                          <option value="date_oldest">Oldest First</option>
                        </select>
                      </div>
                    </div>
                    <div className="divide-y divide-slate-100 overflow-y-auto flex-1">
                      {subjects
                        .filter(s => s.name.toLowerCase().includes(subjectSearchTerm.toLowerCase()))
                        .sort((a, b) => {
                          if (subjectSortOrder === 'name_asc') return a.name.localeCompare(b.name);
                          if (subjectSortOrder === 'name_desc') return b.name.localeCompare(a.name);
                          if (subjectSortOrder === 'date_newest') return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
                          if (subjectSortOrder === 'date_oldest') return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
                          return 0;
                        })
                        .map(s => (
                          <div
                            key={s.id}
                            onClick={() => { setActiveSubject(s.id); setSettingsSubject(s.id); setDashTab('questions'); }}
                            className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors cursor-pointer group"
                            title="Click to manage questions"
                          >
                            <span className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{s.name}</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteSubject(s.id); }}
                              className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-full transition-colors"
                              title="Delete Subject"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        ))}
                      {subjects.length === 0 && <div className="p-8 text-slate-400 text-center italic">No subjects yet.</div>}
                      {subjects.length > 0 && subjects.filter(s => s.name.toLowerCase().includes(subjectSearchTerm.toLowerCase())).length === 0 && (
                        <div className="p-8 text-slate-400 text-center italic">No subjects match your search.</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {dashTab === 'questions' && (
                <div className="space-y-6">
                  {/* Subject Selector */}
                  <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
                    <span className="font-bold text-slate-600">Select Subject to Edit:</span>
                    <select
                      className="p-2 border rounded-lg font-bold text-indigo-600 flex-1"
                      value={activeSubject}
                      onChange={e => { setActiveSubject(e.target.value); setSettingsSubject(e.target.value); }}
                    >
                      <option value="" disabled>Select a Subject</option>
                      {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>

                  {activeSubject ? (
                    <>
                      {/* Add Question Form */}
                      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            {editingQuestionId ? (
                              <>
                                <Pencil className="w-5 h-5 text-indigo-600" />
                                Edit Question
                              </>
                            ) : (
                              <>
                                <Plus className="w-5 h-5 text-indigo-600" />
                                Add Question to <span className="text-indigo-600">{subjects.find(s => s.id === activeSubject)?.name}</span>
                              </>
                            )}
                          </h3>
                          <button onClick={() => setShowImportModal(true)} className="text-sm bg-slate-100 hover:bg-slate-200 text-indigo-700 px-3 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors"><Upload className="w-4 h-4" /> Bulk Import JSON</button>
                        </div>
                        <textarea className="w-full p-3 border rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-slate-200" value={newQuestion.text} onChange={e => setNewQuestion({ ...newQuestion, text: e.target.value })} placeholder="Question text..." rows={2} />

                        {/* Image Upload */}
                        <div className="mb-4">
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Question Image (Optional)</label>
                          <div className="flex items-center gap-4">
                            <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors">
                              <ImageIcon className="w-4 h-4" /> Choose Image
                              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                            </label>
                            {newQuestion.image && (
                              <div className="relative group">
                                <img src={newQuestion.image} alt="Preview" className="h-16 w-16 object-cover rounded-lg border cursor-zoom-in hover:opacity-90 transition-opacity" onClick={() => setZoomedImage(newQuestion.image)} />
                                <button onClick={(e) => { e.stopPropagation(); setNewQuestion({ ...newQuestion, image: null }); }} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600"><X size={12} /></button>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          {newQuestion.options.map((o, i) => (
                            <div key={i} className="flex gap-2 items-center">
                              <input
                                type="radio"
                                name="correctIndex"
                                checked={newQuestion.correctIndex === i}
                                onChange={() => setNewQuestion({ ...newQuestion, correctIndex: i })}
                                className="w-5 h-5 text-indigo-600"
                              />
                              <input
                                className={`w-full p-3 border rounded-lg ${newQuestion.correctIndex === i ? 'border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50' : ''}`}
                                placeholder={`Option ${getLetter(i)}`}
                                value={o}
                                onChange={e => {
                                  const newOptions = [...newQuestion.options];
                                  newOptions[i] = e.target.value;
                                  setNewQuestion({ ...newQuestion, options: newOptions });
                                }}
                              />
                            </div>
                          ))}
                        </div>

                        <div className="flex gap-3 mb-6">
                          <button
                            onClick={() => setNewQuestion({ ...newQuestion, options: [...newQuestion.options, ''] })}
                            className="text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors"
                          >
                            <Plus className="w-4 h-4" /> Add Option
                          </button>
                          {newQuestion.options.length > 2 && (
                            <button
                              onClick={() => {
                                const newOptions = newQuestion.options.slice(0, -1);
                                setNewQuestion({
                                  ...newQuestion,
                                  options: newOptions,
                                  correctIndex: newQuestion.correctIndex >= newOptions.length ? 0 : newQuestion.correctIndex
                                });
                              }}
                              className="text-sm bg-red-50 hover:bg-red-100 text-red-600 px-3 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" /> Remove Option
                            </button>
                          )}
                        </div>

                        {editingQuestionId ? (
                          <div className="flex gap-3">
                            <button onClick={handleCancelEdit} className="flex-1 bg-slate-100 text-slate-600 p-4 rounded-xl font-bold text-lg hover:bg-slate-200 transition-colors">
                              Cancel
                            </button>
                            <button onClick={handleUpdateQuestion} className="flex-1 bg-indigo-600 text-white p-4 rounded-xl font-bold text-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-200">
                              <Save className="w-6 h-6" /> Update Question
                            </button>
                          </div>
                        ) : (
                          <button onClick={handleAddQuestion} className="w-full bg-indigo-600 text-white p-4 rounded-xl font-bold text-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-200">
                            <Plus className="w-6 h-6" /> Add Question to Pool
                          </button>
                        )}
                      </div>

                      {/* Question List */}
                      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-4 bg-slate-50 border-b flex flex-wrap justify-between items-center gap-4">
                          <span className="font-bold text-slate-500 text-xs uppercase">
                            Existing Questions ({filteredQuestions.length})
                          </span>
                          <div className="relative">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                            <input
                              className="pl-9 pr-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48"
                              placeholder="Search questions..."
                              value={questionSearchTerm}
                              onChange={e => setQuestionSearchTerm(e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="divide-y divide-slate-100">
                          {paginatedQuestions.map((q, index) => (
                            <div key={q.id} className="p-4 hover:bg-slate-50">
                              <div className="flex justify-between items-start mb-2">
                                <div
                                  className={`flex gap-2 ${q.image ? 'cursor-zoom-in group' : ''}`}
                                  onClick={(e) => {
                                    if (q.image) {
                                      e.stopPropagation();
                                      setZoomedImage(q.image);
                                    }
                                  }}
                                >
                                  {/* Numbering: (Page-1)*Limit + Index + 1 */}
                                  <span className="font-bold text-slate-400 text-sm whitespace-nowrap pt-0.5">#{((questionCurrentPage - 1) * questionItemsPerPage) + index + 1}</span>
                                  {q.image && <ImageIcon className="w-4 h-4 text-indigo-500 mt-1 flex-shrink-0" />}
                                  <span className={`font-semibold text-slate-800 ${q.image ? 'group-hover:text-indigo-600 transition-colors' : ''}`}><FormattedText text={q.text} /></span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button onClick={() => setMovingQuestionId(movingQuestionId === q.id ? null : q.id)} className="text-indigo-400 hover:text-indigo-600" title="Move to another subject">
                                    <FolderPlus size={18} />
                                  </button>
                                  <button onClick={() => handleEditQuestion(q)} className="text-blue-400 hover:text-blue-600" title="Edit">
                                    <Pencil size={18} />
                                  </button>
                                  <button onClick={() => { setQuestionToDelete(q); setShowDeleteModal(true); }} className="text-red-400 hover:text-red-600" title="Delete">
                                    <Trash2 size={18} />
                                  </button>
                                </div>
                              </div>

                              {/* Move Question UI */}
                              {movingQuestionId === q.id && (
                                <div className="mb-3 bg-indigo-50 p-3 rounded-lg flex items-center gap-3 animate-fadeIn">
                                  <span className="text-xs font-bold text-indigo-700 whitespace-nowrap">Move to:</span>
                                  <select
                                    className="text-xs p-2 rounded border border-indigo-200 flex-1 font-medium text-slate-700"
                                    onChange={(e) => handleMoveQuestion(q.id, e.target.value)}
                                    defaultValue=""
                                  >
                                    <option value="" disabled>Select Subject</option>
                                    {subjects.filter(s => s.id !== activeSubject).map(s => (
                                      <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                  </select>
                                  <button onClick={() => setMovingQuestionId(null)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
                                </div>
                              )}

                              <div className="flex flex-wrap gap-2">{q.options.map((o, i) => (<span key={i} className={`text-xs px-2 py-1 rounded border ${i === q.correctIndex ? 'bg-green-100 text-green-700 border-green-200 font-bold' : 'bg-white text-slate-500 border-slate-200'}`}>{getLetter(i)}. {String(o)}</span>))}</div>
                            </div>
                          ))}
                          {filteredQuestions.length === 0 ? (
                            <div className="p-8 text-center text-slate-400 italic">No questions match your search.</div>
                          ) : null}
                        </div>

                        {/* Pagination Footer - Only show if there are results */}
                        {filteredQuestions.length > 0 && (
                          <div className="p-4 border-t bg-slate-50 flex items-center justify-between">
                            <div className="text-sm text-slate-500 font-medium hidden sm:block">
                              Showing <span className="font-bold">{Math.min((questionCurrentPage - 1) * questionItemsPerPage + 1, filteredQuestions.length)}</span> to <span className="font-bold">{Math.min(questionCurrentPage * questionItemsPerPage, filteredQuestions.length)}</span> of <span className="font-bold">{filteredQuestions.length}</span> questions
                            </div>

                            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                              <div className="flex items-center gap-2 mr-4">
                                <span className="text-sm text-slate-500 font-bold whitespace-nowrap">Rows:</span>
                                <select
                                  className="p-1 border rounded text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                  value={questionItemsPerPage}
                                  onChange={(e) => {
                                    setQuestionItemsPerPage(Number(e.target.value));
                                    setQuestionCurrentPage(1);
                                  }}
                                >
                                  <option value={10}>10</option>
                                  <option value={20}>20</option>
                                  <option value={50}>50</option>
                                  <option value={100}>100</option>
                                </select>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => setQuestionCurrentPage(p => Math.max(1, p - 1))}
                                  disabled={questionCurrentPage === 1}
                                  className={`p-2 rounded-lg border ${questionCurrentPage === 1 ? 'text-slate-300 border-slate-200 cursor-not-allowed' : 'text-indigo-600 border-indigo-200 hover:bg-indigo-50 font-bold'}`}
                                >
                                  <ChevronLeft size={16} />
                                </button>

                                <span className="text-sm font-bold text-slate-600 mx-2">
                                  Page {questionCurrentPage} of {totalQuestionPages || 1}
                                </span>

                                <button
                                  onClick={() => setQuestionCurrentPage(p => Math.min(totalQuestionPages, p + 1))}
                                  disabled={questionCurrentPage === totalQuestionPages || totalQuestionPages === 0}
                                  className={`p-2 rounded-lg border ${questionCurrentPage === totalQuestionPages || totalQuestionPages === 0 ? 'text-slate-300 border-slate-200 cursor-not-allowed' : 'text-indigo-600 border-indigo-200 hover:bg-indigo-50 font-bold'}`}
                                >
                                  <ChevronRight size={16} />
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                        {/* END PAGINATION FOOTER */}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-300">
                      <Layers className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                      <h3 className="text-lg font-bold text-slate-600">Select a Subject</h3>
                      <p className="text-slate-400">Please select a subject above to manage questions.</p>
                    </div>
                  )}
                </div>
              )}


              {dashTab === 'results' && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-xl text-slate-800 flex items-center gap-2"><BarChart className="w-6 h-6" /> Student Results</h3>
                    <div className="flex items-center gap-4">
                      <input
                        type="date"
                        className="p-2 border rounded-lg text-sm font-bold text-slate-600 bg-white"
                        value={resultFilterDate}
                        onChange={e => setResultFilterDate(e.target.value)}
                      />
                      <div className="relative w-48" ref={resultSearchRef}>
                        <div className="relative">
                          <input
                            className="w-full pl-3 pr-8 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-600 cursor-pointer"
                            value={resultSubjectSearch}
                            onFocus={() => {
                              if (resultSubjectSearch === 'All Subjects') {
                                setResultSubjectSearch('');
                              }
                              setShowResultSearchList(true);
                            }}
                            onBlur={() => {
                              // Delay to allow click event to fire first if selecting an option
                              setTimeout(() => {
                                if (latestResultFilterSubject.current === 'all') {
                                  setResultSubjectSearch('All Subjects');
                                } else {
                                  const subj = subjects.find(s => s.id === latestResultFilterSubject.current);
                                  if (subj) setResultSubjectSearch(subj.name);
                                }
                              }, 200);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const filtered = subjects.filter(s => s.name.toLowerCase().includes(resultSubjectSearch.toLowerCase()));
                                if (filtered.length > 0) {
                                  setResultFilterSubject(filtered[0].id);
                                  setResultSubjectSearch(filtered[0].name);
                                  setShowResultSearchList(false);
                                }
                              }
                            }}
                            onClick={() => setShowResultSearchList(true)}
                            onChange={e => {
                              setResultSubjectSearch(e.target.value);
                              setShowResultSearchList(true);
                            }}
                          />
                          <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
                            {resultSubjectSearch && resultSubjectSearch !== 'All Subjects' && (
                              <button
                                onClick={() => {
                                  setResultSubjectSearch('All Subjects');
                                  setResultFilterSubject('all');
                                  setShowResultSearchList(true);
                                }}
                                className="text-slate-400 hover:text-slate-600"
                              >
                                <X size={14} />
                              </button>
                            )}
                            <ChevronDown size={14} className="text-slate-400" />
                          </div>
                        </div>

                        {showResultSearchList && (
                          <div className="absolute top-full left-0 right-0 z-50 bg-white border border-slate-200 rounded-lg shadow-xl mt-1 max-h-60 overflow-y-auto">
                            <div
                              onClick={() => {
                                setResultFilterSubject('all');
                                setResultSubjectSearch('All Subjects');
                                setShowResultSearchList(false);
                              }}
                              className={`p-2 cursor-pointer transition-colors border-b last:border-b-0 text-sm ${resultFilterSubject === 'all' ? 'bg-indigo-50 text-indigo-700 font-bold' : 'hover:bg-slate-50 text-slate-700'}`}
                            >
                              All Subjects
                            </div>
                            {subjects.filter(s => s.name.toLowerCase().includes(resultSubjectSearch.toLowerCase()) || resultSubjectSearch === 'All Subjects').length > 0 ? (
                              subjects
                                .filter(s => s.name.toLowerCase().includes(resultSubjectSearch.toLowerCase()) || resultSubjectSearch === 'All Subjects')
                                .map(s => (
                                  <div
                                    key={s.id}
                                    onClick={() => {
                                      setResultFilterSubject(s.id);
                                      setResultSubjectSearch(s.name);
                                      setShowResultSearchList(false);
                                    }}
                                    className={`p-2 cursor-pointer transition-colors border-b last:border-b-0 text-sm ${resultFilterSubject === s.id ? 'bg-indigo-50 text-indigo-700 font-bold' : 'hover:bg-slate-50 text-slate-700'}`}
                                  >
                                    {s.name}
                                  </div>
                                ))
                            ) : (
                              <div className="p-2 text-slate-400 italic text-center text-sm">No matches</div>
                            )}
                          </div>
                        )}
                      </div>
                      <button onClick={handleExportCSV} className="text-indigo-600 font-bold text-sm hover:bg-indigo-50 px-3 py-2 rounded-lg transition-colors flex items-center gap-2 border border-indigo-200 bg-white">
                        <Download className="w-4 h-4" /> Export CSV
                      </button>
                      {selectedResultIds.size > 0 && (
                        <button onClick={handleBulkDeleteResults} className="text-red-600 font-bold text-sm hover:bg-red-50 px-3 py-1 rounded-lg transition-colors">
                          Delete Selected ({selectedResultIds.size})
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 text-sm uppercase tracking-wider">
                          <th className="p-4 w-10">
                            <input
                              type="checkbox"
                              className="rounded border-slate-300"
                              checked={
                                (() => {
                                  return selectedResultIds.size === filteredResults.length && filteredResults.length > 0;
                                })()
                              }
                              onChange={toggleSelectAllResults}
                            />
                          </th>
                          <th className="p-4 font-bold">Student</th>
                          <th className="p-4 font-bold">Subject</th>
                          <th className="p-4 font-bold">Score</th>
                          <th className="p-4 font-bold">Date</th>
                          <th className="p-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {paginatedResults.map(r => (
                          <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-4">
                              <input
                                type="checkbox"
                                className="rounded border-slate-300"
                                checked={selectedResultIds.has(r.id)}
                                onChange={() => toggleResultSelection(r.id)}
                              />
                            </td>
                            <td className="p-4 font-semibold text-slate-800">
                              <div>{r.studentName}</div>
                              <div className="text-xs text-slate-400 font-normal">{r.studentId}</div>
                            </td>
                            <td className="p-4 text-slate-600 text-sm">{r.subjectName || '-'}</td>
                            <td className="p-4 font-bold text-indigo-600">{r.score} / {r.totalQuestions}</td>
                            <td className="p-4 text-slate-500 text-sm">{r.timestamp?.toDate().toLocaleString('en-GB')}</td>
                            <td className="p-4 text-right flex justify-end gap-2">
                              <button onClick={() => setSelectedResult(r)} className="text-indigo-400 hover:text-indigo-600" title="View Details"><Eye size={18} /></button>
                              <button onClick={() => handleDeleteResult(r.id)} className="text-red-400 hover:text-red-600" title="Delete"><Trash2 size={18} /></button>
                            </td>
                          </tr>
                        ))}
                        {filteredResults.length === 0 && (
                          <tr>
                            <td colSpan="6" className="p-8 text-center text-slate-400 italic">No results found.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  {/* Pagination Footer */}
                  <div className="p-4 border-t bg-slate-50 flex items-center justify-between">
                    <div className="text-sm text-slate-500 font-medium hidden sm:block">
                      Showing <span className="font-bold">{Math.min((resultCurrentPage - 1) * resultItemsPerPage + 1, filteredResults.length)}</span> to <span className="font-bold">{Math.min(resultCurrentPage * resultItemsPerPage, filteredResults.length)}</span> of <span className="font-bold">{filteredResults.length}</span> results
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                      <div className="flex items-center gap-2 mr-4">
                        <span className="text-sm text-slate-500 font-bold whitespace-nowrap">Rows:</span>
                        <select
                          className="p-1 border rounded text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          value={resultItemsPerPage}
                          onChange={(e) => {
                            setResultItemsPerPage(Number(e.target.value));
                            setResultCurrentPage(1);
                          }}
                        >
                          <option value={10}>10</option>
                          <option value={20}>20</option>
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setResultCurrentPage(p => Math.max(1, p - 1))}
                          disabled={resultCurrentPage === 1}
                          className={`p-2 rounded-lg border ${resultCurrentPage === 1 ? 'text-slate-300 border-slate-200 cursor-not-allowed' : 'text-indigo-600 border-indigo-200 hover:bg-indigo-50 font-bold'}`}
                        >
                          <ChevronLeft size={16} />
                        </button>

                        <span className="text-sm font-bold text-slate-600 mx-2">
                          Page {resultCurrentPage} of {totalPages || 1}
                        </span>

                        <button
                          onClick={() => setResultCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={resultCurrentPage === totalPages || totalPages === 0}
                          className={`p-2 rounded-lg border ${resultCurrentPage === totalPages || totalPages === 0 ? 'text-slate-300 border-slate-200 cursor-not-allowed' : 'text-indigo-600 border-indigo-200 hover:bg-indigo-50 font-bold'}`}
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {dashTab === 'settings' && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 max-w-lg mx-auto">
                  <h3 className="font-bold text-xl text-slate-800 mb-6 flex items-center gap-2"><Settings className="w-6 h-6" /> Quiz Configuration</h3>

                  <div className="mb-6">
                    <label className="block text-base font-bold text-slate-700 mb-2">Select Subject to Configure</label>
                    <select
                      className="w-full p-3 border rounded-xl mb-4 font-bold text-indigo-600"
                      value={settingsSubject}
                      onChange={e => { setSettingsSubject(e.target.value); setActiveSubject(e.target.value); }}
                    >
                      {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>

                    <label className="block text-base font-bold text-slate-700 mb-2">Question Source</label>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6">
                      <div className="flex gap-6 mb-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="sourceMode"
                            checked={settingSourceMode === 'own'}
                            onChange={() => setSettingSourceMode('own')}
                            className="w-5 h-5 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className={`font-bold ${settingSourceMode === 'own' ? 'text-indigo-700' : 'text-slate-600'}`}>Own Questions</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="sourceMode"
                            checked={settingSourceMode === 'composite'}
                            onChange={() => setSettingSourceMode('composite')}
                            className="w-5 h-5 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className={`font-bold ${settingSourceMode === 'composite' ? 'text-indigo-700' : 'text-slate-600'}`}>Composite / Question Bank</span>
                        </label>
                      </div>

                      {settingSourceMode === 'composite' && (
                        <div className="space-y-3 bg-white p-4 rounded-lg border border-slate-200 h-64 overflow-y-auto">
                          <p className="text-xs text-slate-500 uppercase font-bold mb-2">Select Source Subjects</p>
                          {subjects.filter(s => s.id !== settingsSubject).map(s => {
                            const config = settingCompositeConfig.find(c => c.id === s.id);
                            const isChecked = !!config;

                            return (
                              <div key={s.id} className={`flex items-center justify-between p-2 rounded-lg border ${isChecked ? 'bg-indigo-50 border-indigo-200' : 'border-slate-100'}`}>
                                <div className="flex items-center gap-3">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSettingCompositeConfig([...settingCompositeConfig, { id: s.id, count: 5 }]);
                                      } else {
                                        setSettingCompositeConfig(settingCompositeConfig.filter(c => c.id !== s.id));
                                      }
                                    }}
                                    className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                  />
                                  <span className={`text-sm font-semibold ${isChecked ? 'text-indigo-900' : 'text-slate-600'}`}>{s.name}</span>
                                </div>
                                {isChecked && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-500 font-bold uppercase">Count:</span>
                                    <input
                                      type="number"
                                      min="1"
                                      value={config.count}
                                      onChange={(e) => {
                                        const val = Math.max(1, Number(e.target.value));
                                        setSettingCompositeConfig(settingCompositeConfig.map(c => c.id === s.id ? { ...c, count: val } : c));
                                      }}
                                      className="w-16 p-1 text-center font-bold border rounded-md text-sm text-indigo-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          {subjects.filter(s => s.id !== settingsSubject).length === 0 && (
                            <div className="text-center text-slate-400 text-sm italic py-4">No other subjects available.</div>
                          )}
                        </div>
                      )}

                      {settingSourceMode === 'composite' && (
                        <div className="mt-4 pt-4 border-t border-slate-200 flex justify-between items-center text-sm">
                          <span className="text-slate-600">Selected: <strong className="text-indigo-700">{settingCompositeConfig.length}</strong> subjects</span>
                          <span className="text-slate-600">Total Questions: <strong className="text-indigo-700">{settingCompositeConfig.reduce((sum, c) => sum + c.count, 0)}</strong></span>
                        </div>
                      )}
                    </div>

                    <label className="block text-base font-bold text-slate-700 mb-2">Number of Questions (Limit)</label>
                    <p className="text-sm text-slate-500 mb-4">
                      {settingSourceMode === 'composite'
                        ? "This limit acts as a maximum cap for the total composite exam."
                        : "How many questions will be randomly selected for this subject?"}
                    </p>
                    <input
                      type="number"
                      className="w-full p-3 text-2xl font-bold border rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-100 border-slate-200 mb-6"
                      value={settingLimit}
                      onChange={e => setSettingLimit(e.target.value)}
                    />

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="timerEnabled"
                          checked={settingTimerEnabled}
                          onChange={e => setSettingTimerEnabled(e.target.checked)}
                          className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                        />
                        <label htmlFor="timerEnabled" className="text-slate-700 font-medium">Enable Timer</label>
                      </div>
                    </div>

                    {settingTimerEnabled && (
                      <div className="mb-6 mt-6">
                        <label className="block text-sm font-bold text-slate-700 mb-2">Time Limit</label>
                        <div className="flex gap-4 items-center">
                          <div className="flex-1">
                            <label className="block text-xs text-slate-500 mb-1">Minutes</label>
                            <input
                              type="number"
                              value={settingTimeMin}
                              onChange={e => setSettingTimeMin(e.target.value)}
                              className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-bold text-slate-700"
                              min="0"
                            />
                          </div>
                          <span className="text-slate-400 font-bold text-xl mt-4">:</span>
                          <div className="flex-1">
                            <label className="block text-xs text-slate-500 mb-1">Seconds</label>
                            <input
                              type="number"
                              value={settingTimeSec}
                              onChange={e => setSettingTimeSec(e.target.value)}
                              className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-bold text-slate-700"
                              min="0"
                              max="59"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {settingTimerEnabled && (
                      <div className="mb-6">
                        <label className="block text-sm font-bold text-slate-700 mb-2">Warning Alert</label>
                        <div className="flex gap-4 items-center">
                          <div className="flex-1">
                            <label className="block text-xs text-slate-500 mb-1">Minutes</label>
                            <input
                              type="number"
                              value={settingWarningMin}
                              onChange={e => setSettingWarningMin(e.target.value)}
                              className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-bold text-slate-700"
                              min="0"
                            />
                          </div>
                          <span className="text-slate-400 font-bold text-xl mt-4">:</span>
                          <div className="flex-1">
                            <label className="block text-xs text-slate-500 mb-1">Seconds</label>
                            <input
                              type="number"
                              value={settingWarningSec}
                              onChange={e => setSettingWarningSec(e.target.value)}
                              className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-bold text-slate-700"
                              min="0"
                              max="59"
                            />
                          </div>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">Default is 1 minute (60 seconds).</p>
                      </div>
                    )}
                  </div>

                  <button onClick={saveSettings} className="w-full bg-indigo-600 text-white p-3 rounded-xl font-bold text-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-200">
                    <Save className="w-5 h-5" /> Save Configuration
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      }
    </div >
  );
}