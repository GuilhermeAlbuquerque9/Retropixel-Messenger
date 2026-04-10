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
  updateDoc,
  where
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";

/* ================= VARIÁVEIS ================= */

let currentUser = null;
let currentChat = null;
let unsubscribe = null;

/* ================= LOGIN ================= */

window.login = async () => {
  const email = document.getElementById("email")?.value;
  const password = document.getElementById("password")?.value;

  if (!email || !password) {
    alert("Preencha tudo!");
    return;
  }

  await signInWithEmailAndPassword(auth, email, password);
};

window.register = async () => {
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
};

/* ================= AUTH ================= */

onAuthStateChanged(auth, (user) => {
  const isIndex = location.pathname.includes("index") || location.pathname === "/";
  const isApp = location.pathname.includes("app");

  if (user && isIndex) location.href = "app.html";
  if (!user && isApp) location.href = "index.html";

  if (user && isApp) initApp(user);
});

/* ================= INIT ================= */

function initApp(user) {
  currentUser = user;

  // define status online
  updateDoc(doc(db, "users", user.uid), {
    status: "online"
  });

  loadContacts();
}

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

    const users = await getDocs(collection(db, "users"));

    users.forEach(u => {
      if (u.id === data.contactId) {
        const userData = u.data();

        const div = document.createElement("div");
        div.className = "contact";

        div.innerHTML = `
          <span class="status ${userData.status}"></span>
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

window.addContact = async () => {
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

/* ================= REALTIME ================= */

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

      // NUDGE
      if (msg.type === "nudge") {
        shakeWindow();
        playSound("nudge");
        return;
      }

      const div = document.createElement("div");
      div.className = msg.sender === currentUser.uid ? "msg me" : "msg";
      div.innerText = msg.text;

      el.appendChild(div);

      // som ao receber
      if (msg.sender !== currentUser.uid) {
        playSound("receive");
      }
    });

    el.scrollTop = el.scrollHeight;
  });
}

/* ================= SEND ================= */

window.sendMessage = async () => {
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

window.sendNudge = async () => {
  if (!currentChat) return;

  await addDoc(collection(db, "messages", currentChat, "chat"), {
    type: "nudge",
    sender: currentUser.uid,
    timestamp: serverTimestamp()
  });

  playSound("nudge");
};

/* ================= STATUS ================= */

window.saveStatus = async () => {
  const status = document.getElementById("statusSelect")?.value;

  if (!status) return;

  await updateDoc(doc(db, "users", currentUser.uid), {
    status
  });

  alert("Status atualizado!");
  loadContacts();
};

/* ================= LOGOUT ================= */

window.logout = async () => {
  await updateDoc(doc(db, "users", currentUser.uid), {
    status: "offline"
  });

  await signOut(auth);
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
