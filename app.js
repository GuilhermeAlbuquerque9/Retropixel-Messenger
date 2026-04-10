import { auth, db } from "./firebase.js";

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js";

import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  doc,
  setDoc,
  getDocs,
  where
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";

/* ================= VARS ================= */

let currentUser = null;
let currentChat = null;
let unsubscribe = null;

/* ================= HELPERS ================= */

function playClick() {
  const el = document.getElementById("clickSound");
  if (!el) return;
  el.currentTime = 0;
  el.play().catch(()=>{});
}

function playNudge() {
  const el = document.getElementById("nudgeSound");
  if (!el) return;
  el.currentTime = 0;
  el.play().catch(()=>{});
}

/* ================= AUTH ================= */

onAuthStateChanged(auth, async (user) => {
  const isIndex = location.pathname.includes("index") || location.pathname === "/";
  const isApp = location.pathname.includes("app");

  if (user && isIndex) {
    location.href = "app.html";
    return;
  }

  if (!user && isApp) {
    location.href = "index.html";
    return;
  }

  if (user && isApp) {
    currentUser = user;

    await setDoc(doc(db, "users", user.uid), {
      email: user.email,
      status: "online"
    }, { merge: true });

    setupAppUI();
    loadContacts();
  }

  if (isIndex) setupLoginUI();
});

/* ================= LOGIN UI ================= */

function setupLoginUI() {
  const loginBtn = document.getElementById("loginBtn");
  const registerBtn = document.getElementById("registerBtn");

  if (loginBtn) {
    loginBtn.addEventListener("click", login);
  }

  if (registerBtn) {
    registerBtn.addEventListener("click", register);
  }
}

/* ================= APP UI ================= */

function setupAppUI() {
  document.getElementById("logoutBtn")?.addEventListener("click", logout);
  document.getElementById("sendBtn")?.addEventListener("click", sendMessage);
  document.getElementById("nudgeBtn")?.addEventListener("click", sendNudge);
  document.getElementById("addContactBtn")?.addEventListener("click", addContact);

  document.getElementById("sobreBtn")?.addEventListener("click", () => location.href = "sobre.html");
  document.getElementById("configBtn")?.addEventListener("click", () => location.href = "configuracoes.html");
  document.getElementById("termosBtn")?.addEventListener("click", () => location.href = "termos.html");
}

/* ================= LOGIN ================= */

async function login() {
  playClick();

  const email = document.getElementById("email")?.value;
  const password = document.getElementById("password")?.value;

  if (!email || !password) return alert("Preencha tudo!");

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (e) {
    alert(e.message);
  }
}

/* ================= REGISTER ================= */

async function register() {
  playClick();

  const email = document.getElementById("email")?.value;
  const password = document.getElementById("password")?.value;

  if (!email || !password) return alert("Preencha tudo!");

  try {
    const userCred = await createUserWithEmailAndPassword(auth, email, password);

    await setDoc(doc(db, "users", userCred.user.uid), {
      email,
      status: "online"
    });

    alert("Conta criada!");
  } catch (e) {
    alert(e.message);
  }
}

/* ================= LOGOUT ================= */

async function logout() {
  playClick();

  await setDoc(doc(db, "users", currentUser.uid), {
    status: "offline"
  }, { merge: true });

  await signOut(auth);
}

/* ================= CONTATOS ================= */

async function loadContacts() {
  const el = document.getElementById("contacts");
  if (!el) return;

  el.innerHTML = "Carregando...";

  const q = query(collection(db, "contacts"), where("owner", "==", currentUser.uid));
  const snapshot = await getDocs(q);

  el.innerHTML = "";

  const users = await getDocs(collection(db, "users"));

  snapshot.forEach(docSnap => {
    const data = docSnap.data();

    users.forEach(u => {
      if (u.id === data.contactId) {
        const userData = u.data();

        const div = document.createElement("div");
        div.className = "contact";

        div.innerHTML = `
          <span class="status ${userData.status || "offline"}"></span>
          <img src="assets/avatar.png" class="contact-avatar">
          ${userData.email}
        `;

        div.onclick = () => openChat(u.id, userData.email);

        el.appendChild(div);
      }
    });
  });
}

/* ================= ADD CONTATO ================= */

async function addContact() {
  playClick();

  const email = prompt("Email do contato:");
  if (!email) return;

  const users = await getDocs(collection(db, "users"));

  let found = null;

  users.forEach(u => {
    if (u.data().email === email) {
      found = { id: u.id };
    }
  });

  if (!found) return alert("Usuário não encontrado!");

  await addDoc(collection(db, "contacts"), {
    owner: currentUser.uid,
    contactId: found.id
  });

  loadContacts();
}

/* ================= CHAT ================= */

function getChatId(a, b) {
  return [a, b].sort().join("_");
}

function openChat(uid, email) {
  currentChat = getChatId(currentUser.uid, uid);
  document.getElementById("chatTitle").innerText = email;
  listenMessages();
}

/* ================= MENSAGENS ================= */

function listenMessages() {
  if (unsubscribe) unsubscribe();

  const el = document.getElementById("messages");

  const q = query(
    collection(db, "messages", currentChat, "chat"),
    orderBy("timestamp")
  );

  unsubscribe = onSnapshot(q, snap => {
    el.innerHTML = "";

    snap.forEach(docSnap => {
      const msg = docSnap.data();

      if (msg.type === "nudge") {
        shakeWindow();
        playNudge();
        return;
      }

      const div = document.createElement("div");
      div.className = msg.sender === currentUser.uid ? "msg me" : "msg";
      div.innerText = msg.text;

      el.appendChild(div);
    });

    el.scrollTop = el.scrollHeight;
  });
}

/* ================= SEND ================= */

async function sendMessage() {
  playClick();

  const input = document.getElementById("messageInput");
  if (!input.value || !currentChat) return;

  await addDoc(collection(db, "messages", currentChat, "chat"), {
    text: input.value,
    sender: currentUser.uid,
    timestamp: serverTimestamp()
  });

  input.value = "";
}

async function sendNudge() {
  playClick();

  if (!currentChat) return;

  await addDoc(collection(db, "messages", currentChat, "chat"), {
    type: "nudge",
    sender: currentUser.uid,
    timestamp: serverTimestamp()
  });

  playNudge();
}

/* ================= NUDGE FX ================= */

function shakeWindow() {
  const el = document.querySelector(".messenger-window");
  let i = 0;

  const interval = setInterval(() => {
    el.style.transform = `translate(${i % 2 ? 6 : -6}px,0)`;
    i++;

    if (i > 10) {
      clearInterval(interval);
      el.style.transform = "translate(0,0)";
    }
  }, 40);
}
