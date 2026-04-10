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

    // garante criação/atualização do usuário
    await setDoc(doc(db, "users", user.uid), {
      email: user.email,
      status: "online"
    }, { merge: true });

    loadContacts();
  }
});

/* ================= LOGIN ================= */

window.login = async function () {
  try {
    const email = document.getElementById("email")?.value;
    const password = document.getElementById("password")?.value;

    if (!email || !password) {
      alert("Preencha tudo!");
      return;
    }

    await signInWithEmailAndPassword(auth, email, password);

  } catch (error) {
    alert("Erro ao entrar: " + error.message);
  }
};

/* ================= REGISTER ================= */

window.register = async function () {
  try {
    const email = document.getElementById("email")?.value;
    const password = document.getElementById("password")?.value;

    if (!email || !password) {
      alert("Preencha tudo!");
      return;
    }

    const userCred = await createUserWithEmailAndPassword(auth, email, password);

    await setDoc(doc(db, "users", userCred.user.uid), {
      email,
      status: "online"
    });

    alert("Conta criada! Agora você pode entrar.");

  } catch (error) {
    if (error.code === "auth/email-already-in-use") {
      alert("Esse email já existe!");
    } else {
      alert("Erro: " + error.message);
    }
  }
};

/* ================= LOGOUT ================= */

window.logout = async function () {
  if (!currentUser) return;

  await setDoc(doc(db, "users", currentUser.uid), {
    status: "offline"
  }, { merge: true });

  await signOut(auth);
};

/* ================= CONTATOS ================= */

async function loadContacts() {
  const el = document.getElementById("contacts");
  if (!el) return;

  el.innerHTML = "Carregando...";

  const q = query(
    collection(db, "contacts"),
    where("owner", "==", currentUser.uid)
  );

  const snapshot = await getDocs(q);

  el.innerHTML = "";

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();

    const usersSnap = await getDocs(collection(db, "users"));

    usersSnap.forEach(u => {
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
  }

  if (el.innerHTML === "") {
    el.innerHTML = "Nenhum contato ainda 😢";
  }
}

/* ================= ADD CONTATO ================= */

window.addContact = async function () {
  const email = prompt("Email do contato:");
  if (!email) return;

  const users = await getDocs(collection(db, "users"));

  let found = null;

  users.forEach(u => {
    if (u.data().email === email) {
      found = { id: u.id, ...u.data() };
    }
  });

  if (!found) {
    alert("Usuário não encontrado!");
    return;
  }

  await addDoc(collection(db, "contacts"), {
    owner: currentUser.uid,
    contactId: found.id
  });

  alert("Contato adicionado!");
  loadContacts();
};

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
  if (!el) return;

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
        playSound("nudge");
        return;
      }

      const div = document.createElement("div");
      div.className = msg.sender === currentUser.uid ? "msg me" : "msg";
      div.innerText = msg.text;

      el.appendChild(div);

      if (msg.sender !== currentUser.uid) {
        playSound("receive");
      }
    });

    el.scrollTop = el.scrollHeight;
  });
}

/* ================= ENVIAR ================= */

window.sendMessage = async function () {
  const input = document.getElementById("messageInput");

  if (!input || !input.value || !currentChat) return;

  await addDoc(collection(db, "messages", currentChat, "chat"), {
    text: input.value,
    sender: currentUser.uid,
    timestamp: serverTimestamp()
  });

  playSound("send");

  input.value = "";
};

window.sendNudge = async function () {
  if (!currentChat) return;

  await addDoc(collection(db, "messages", currentChat, "chat"), {
    type: "nudge",
    sender: currentUser.uid,
    timestamp: serverTimestamp()
  });

  playSound("nudge");
};

/* ================= SONS ================= */

function playSound(type) {
  const audio = new Audio(`assets/${type}.wav`);
  audio.volume = 0.5;
  audio.play().catch(() => {});
}

document.addEventListener("click", () => {
  playSound("click");
});

/* ================= NUDGE FX ================= */

function shakeWindow() {
  const el = document.querySelector(".messenger-window");
  if (!el) return;

  let i = 0;

  const interval = setInterval(() => {
    el.style.transform = `translate(${i % 2 ? 6 : -6}px, 0)`;
    i++;

    if (i > 10) {
      clearInterval(interval);
      el.style.transform = "translate(0,0)";
    }
  }, 40);
}
