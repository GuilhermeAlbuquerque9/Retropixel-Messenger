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
  where,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";

/* ================= VARS ================= */

let currentUser = null;
let currentChat = null;
let unsubscribe = null;
let typingTimeout = null;

/* ================= INIT ================= */

document.addEventListener("DOMContentLoaded", () => {
  setupLoginUI();
  setupAppUI();
});

/* ================= SOUND ================= */

function playSound(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.currentTime = 0;
  el.play().catch(()=>{});
}

/* ================= STATUS ================= */

function getStatusEmoji(status) {
  switch (status) {
    case "online": return "🟢";
    case "offline": return "🔴";
    case "dnd": return "⛔";
    case "auto": return "🤖";
    default: return "🔴";
  }
}

/* ================= AUTH ================= */

onAuthStateChanged(auth, async (user) => {

  const path = location.pathname;
  const isApp = path.includes("app.html");
  const isIndex = !isApp;

  try {

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
        status: "online",
        lastActive: Date.now()
      }, { merge: true });

      loadContacts();
    }

  } catch (e) {
    console.error(e);
  }
});

/* ================= LOGIN UI ================= */

function setupLoginUI() {
  document.getElementById("loginBtn")?.addEventListener("click", login);
  document.getElementById("registerBtn")?.addEventListener("click", register);
}

/* ================= APP UI ================= */

function setupAppUI() {
  document.getElementById("logoutBtn")?.addEventListener("click", logout);
  document.getElementById("sendBtn")?.addEventListener("click", sendMessage);
  document.getElementById("nudgeBtn")?.addEventListener("click", sendNudge);
  document.getElementById("addContactBtn")?.addEventListener("click", addContact);

  document.getElementById("sobreBtn")?.addEventListener("click", () => {
    playSound("clickSound");
    location.href = "sobre.html";
  });

  document.getElementById("configBtn")?.addEventListener("click", () => {
    playSound("clickSound");
    location.href = "configuracoes.html";
  });

  document.getElementById("termosBtn")?.addEventListener("click", () => {
    playSound("clickSound");
    location.href = "termos.html";
  });

  /* DIGITANDO */
  document.getElementById("messageInput")?.addEventListener("input", async () => {
    if (!currentChat || !currentUser) return;

    await setDoc(doc(db, "typing", currentChat + "_" + currentUser.uid), {
      typing: true,
      time: Date.now()
    });

    clearTimeout(typingTimeout);

    typingTimeout = setTimeout(async () => {
      await setDoc(doc(db, "typing", currentChat + "_" + currentUser.uid), {
        typing: false
      });
    }, 2000);
  });
}

/* ================= LOGIN ================= */

async function login() {
  playSound("clickSound");

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
  playSound("clickSound");

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
  playSound("clickSound");

  if (!currentUser) return;

  await setDoc(doc(db, "users", currentUser.uid), {
    status: "offline"
  }, { merge: true });

  await signOut(auth);
}

/* ================= CONTATOS ================= */

async function loadContacts() {
  const el = document.getElementById("contacts");
  if (!el || !currentUser) return;

  el.innerHTML = "Carregando...";

  const q = query(collection(db, "contacts"), where("owner", "==", currentUser.uid));
  const snapshot = await getDocs(q);
  const users = await getDocs(collection(db, "users"));

  el.innerHTML = "";

  snapshot.forEach(docSnap => {
    const data = docSnap.data();

    users.forEach(u => {
      if (u.id === data.contactId) {
        const userData = u.data();

        const div = document.createElement("div");
        div.className = "contact";

        div.innerHTML = `
          <span>${getStatusEmoji(userData.status)}</span>
          <img src="assets/avatar.png" class="contact-avatar">
          ${userData.email}
        `;

        div.onclick = () => {
          playSound("clickSound");
          openChat(u.id, userData.email);
        };

        el.appendChild(div);
      }
    });
  });
}

/* ================= ADD CONTATO ================= */

async function addContact() {
  playSound("clickSound");

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

  const title = document.getElementById("chatTitle");
  if (title) title.innerText = email;

  listenMessages();
}

/* ================= MENSAGENS ================= */

function listenMessages() {
  if (unsubscribe) unsubscribe();

  const el = document.getElementById("messages");
  if (!el || !currentChat) return;

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

        if (msg.sender !== currentUser.uid) {
          playSound("nudgeSound");
        }

        return;
      }

      const div = document.createElement("div");
      div.className = msg.sender === currentUser.uid ? "msg me" : "msg";

      div.innerHTML = msg.text;

      if (msg.sender === currentUser.uid) {
        const btn = document.createElement("button");
        btn.innerText = "x";
        btn.className = "delete-btn";

        btn.onclick = async () => {
          await deleteDoc(doc(db, "messages", currentChat, "chat", docSnap.id));
        };

        div.appendChild(btn);
      }

      el.appendChild(div);
    });

    el.scrollTop = el.scrollHeight;
  });

  /* DIGITANDO LISTENER */
  const typingRef = collection(db, "typing");

  onSnapshot(typingRef, snap => {
    let typing = false;

    snap.forEach(docSnap => {
      const data = docSnap.data();

      if (
        docSnap.id.startsWith(currentChat) &&
        data.typing &&
        Date.now() - data.time < 3000 &&
        !docSnap.id.endsWith(currentUser.uid)
      ) {
        typing = true;
      }
    });

    const elTitle = document.getElementById("chatTitle");
    if (!elTitle) return;

    elTitle.innerText = typing ? "Digitando..." : "Chat";
  });
}

/* ================= SEND ================= */

async function sendMessage() {
  playSound("sendSound");

  const input = document.getElementById("messageInput");
  if (!input || !input.value || !currentChat) return;

  await addDoc(collection(db, "messages", currentChat, "chat"), {
    text: input.value,
    sender: currentUser.uid,
    timestamp: serverTimestamp()
  });

  await setDoc(doc(db, "typing", currentChat + "_" + currentUser.uid), {
    typing: false
  });

  input.value = "";
}

async function sendNudge() {
  playSound("nudgeSound");

  if (!currentChat) return;

  await addDoc(collection(db, "messages", currentChat, "chat"), {
    type: "nudge",
    sender: currentUser.uid,
    timestamp: serverTimestamp()
  });
}

/* ================= NUDGE FX ================= */

function shakeWindow() {
  const el = document.querySelector(".messenger-window");
  if (!el) return;

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
