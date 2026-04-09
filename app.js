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
  getDocs
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";

// ==========================
// 🔐 LOGIN / REGISTRO
// ==========================

window.login = async function () {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  if (!email || !password) {
    alert("Preencha email e senha!");
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (e) {
    alert("Erro: " + e.message);
  }
};

window.register = async function () {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  if (!email || !password) {
    alert("Preencha email e senha!");
    return;
  }

  try {
    const userCred = await createUserWithEmailAndPassword(auth, email, password);

    // salva no Firestore
    await setDoc(doc(db, "users", userCred.user.uid), {
      email: email,
      status: "online"
    });

  } catch (e) {
    alert("Erro: " + e.message);
  }
};

// ==========================
// 🔁 ESTADO DE AUTENTICAÇÃO
// ==========================

onAuthStateChanged(auth, (user) => {

  const isIndex = window.location.pathname.includes("index.html") || window.location.pathname === "/";
  const isApp = window.location.pathname.includes("app.html");

  // Se logado → vai pro app
  if (user && isIndex) {
    window.location.href = "app.html";
  }

  // Se não logado → volta pro login
  if (!user && isApp) {
    window.location.href = "index.html";
  }

  // Se logado no app → inicializa
  if (user && isApp) {
    initApp(user);
  }
});

// ==========================
// 🚀 INICIALIZA APP
// ==========================

let currentUser = null;
let currentChat = null;
let unsubscribe = null;

function initApp(user) {
  currentUser = user;

  loadContacts();
}

// ==========================
// 👥 CONTATOS
// ==========================

async function loadContacts() {
  const contactsDiv = document.getElementById("contacts");

  if (!contactsDiv) return;

  contactsDiv.innerHTML = "Carregando...";

  const snapshot = await getDocs(collection(db, "users"));

  contactsDiv.innerHTML = "";

  snapshot.forEach(docSnap => {
    const data = docSnap.data();

    // não mostrar você mesmo
    if (docSnap.id === currentUser.uid) return;

    const div = document.createElement("div");
    div.className = "contact";

    div.innerText = data.email;

    div.onclick = () => openChat(docSnap.id, data.email);

    contactsDiv.appendChild(div);
  });
}

// ==========================
// 💬 CHAT
// ==========================

function getChatId(uid1, uid2) {
  return [uid1, uid2].sort().join("_");
}

function openChat(uid, email) {
  currentChat = getChatId(currentUser.uid, uid);

  const title = document.getElementById("chatTitle");
  if (title) title.innerText = email;

  listenMessages();
}

// ==========================
// 📡 MENSAGENS REALTIME
// ==========================

function listenMessages() {
  if (unsubscribe) unsubscribe();

  const messagesDiv = document.getElementById("messages");
  if (!messagesDiv) return;

  const q = query(
    collection(db, "messages", currentChat, "chat"),
    orderBy("timestamp")
  );

  unsubscribe = onSnapshot(q, (snapshot) => {

    messagesDiv.innerHTML = "";

    snapshot.forEach(docSnap => {
      const msg = docSnap.data();

      const div = document.createElement("div");
      div.className = msg.sender === currentUser.uid ? "msg me" : "msg";

      div.innerText = msg.text;

      messagesDiv.appendChild(div);

      // 🔊 som ao receber
      if (msg.sender !== currentUser.uid) {
        playSound("receive");
      }
    });

    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  });
}

// ==========================
// ✉️ ENVIAR MENSAGEM
// ==========================

window.sendMessage = async function () {
  const input = document.getElementById("messageInput");

  if (!input || !currentChat) return;

  const text = input.value.trim();

  if (!text) return;

  try {
    await addDoc(collection(db, "messages", currentChat, "chat"), {
      text: text,
      sender: currentUser.uid,
      timestamp: serverTimestamp()
    });

    input.value = "";

    // 🔊 som ao enviar
    playSound("send");

  } catch (e) {
    console.error(e);
  }
};

// ==========================
// 🔊 SONS
// ==========================

function playSound(type) {
  const audio = new Audio(`assets/${type}.wav`);
  audio.volume = 0.4;
  audio.play().catch(() => {});
}

// ==========================
// 🚪 LOGOUT
// ==========================

window.logout = async function () {
  await signOut(auth);
};

import { getDoc } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";

window.addContact = async function () {
  const email = prompt("Digite o email do contato:");

  if (!email) return;

  const snapshot = await getDocs(collection(db, "users"));

  let found = null;

  snapshot.forEach(docSnap => {
    if (docSnap.data().email === email) {
      found = { id: docSnap.id, ...docSnap.data() };
    }
  });

  if (!found) {
    alert("Usuário não encontrado!");
    return;
  }

  // salva contato
  await addDoc(collection(db, "contacts"), {
    owner: currentUser.uid,
    contactId: found.id,
    email: found.email
  });

  alert("Contato adicionado!");
  loadContacts();
};
