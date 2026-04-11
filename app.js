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
  deleteDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";

/* VARS */
let currentUser = null;
let currentChat = null;
let currentContactName = "";
let unsubscribe = null;
let typingTimeout = null;

/* INIT */
document.addEventListener("DOMContentLoaded", () => {
  setupLoginUI();
  setupAppUI();
});

/* SOUND */
function playSound(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.currentTime = 0;
  el.play().catch(()=>{});
}

/* STATUS */
function getStatusEmoji(status) {
  return {
    online: "🟢",
    offline: "🔴",
    dnd: "⛔",
    auto: "🤖"
  }[status] || "🔴";
}

/* AUTH */
onAuthStateChanged(auth, async (user) => {
  const path = location.pathname;
  const isApp = path.includes("app.html");
  const isConfig = path.includes("configuracoes.html");

  if (!user && (isApp || isConfig)) {
    location.href = "index.html";
    return;
  }

  if (user) {
    currentUser = user;

    await setDoc(doc(db, "users", user.uid), {
      email: user.email,
      name: user.email.split("@")[0],
      status: "online"
    }, { merge: true });

    if (isApp) loadContacts();
    if (isConfig) loadConfig();
  }
});

/* CONFIG LOAD */
async function loadConfig() {
  const docSnap = await getDoc(doc(db, "users", currentUser.uid));
  const data = docSnap.data();

  document.getElementById("configName").value = data.name || "";
  document.getElementById("configStatus").value = data.status || "online";
  document.getElementById("configBio").value = data.bio || "";
}

/* UPDATE PROFILE */
window.updateProfile = async function () {
  const name = document.getElementById("configName").value;
  const status = document.getElementById("configStatus").value;
  const bio = document.getElementById("configBio").value;

  await setDoc(doc(db, "users", currentUser.uid), {
    name, status, bio
  }, { merge: true });

  alert("Salvo!");
};

/* LOGIN UI */
function setupLoginUI() {
  document.getElementById("loginBtn")?.addEventListener("click", login);
  document.getElementById("registerBtn")?.addEventListener("click", register);
}

/* APP UI */
function setupAppUI() {
  document.getElementById("logoutBtn")?.addEventListener("click", logout);
  document.getElementById("sendBtn")?.addEventListener("click", sendMessage);
  document.getElementById("nudgeBtn")?.addEventListener("click", sendNudge);
  document.getElementById("addContactBtn")?.addEventListener("click", addContact);

  document.getElementById("configBtn")?.addEventListener("click", () => location.href="configuracoes.html");

  document.getElementById("messageInput")?.addEventListener("input", handleTyping);
}

/* LOGIN */
async function login() {
  playSound("clickSound");
  const email = emailInput.value;
  const password = passwordInput.value;
  await signInWithEmailAndPassword(auth, email, password);
}

/* REGISTER */
async function register() {
  playSound("clickSound");
  const email = emailInput.value;
  const password = passwordInput.value;
  await createUserWithEmailAndPassword(auth, email, password);
}

/* LOGOUT */
async function logout() {
  playSound("clickSound");
  await signOut(auth);
}

/* CONTACTS */
async function loadContacts() {
  const el = document.getElementById("contacts");
  el.innerHTML = "";

  const contacts = await getDocs(query(collection(db,"contacts"), where("owner","==",currentUser.uid)));
  const users = await getDocs(collection(db,"users"));

  contacts.forEach(c => {
    users.forEach(u => {
      if (u.id === c.data().contactId) {
        const d = u.data();

        const div = document.createElement("div");
        div.className = "contact";

        div.innerHTML = `
          ${getStatusEmoji(d.status)}
          <img src="assets/avatar.png">
          ${d.name || d.email}
        `;

        div.onclick = () => {
          playSound("clickSound");
          openChat(u.id, d.name || d.email);
        };

        el.appendChild(div);
      }
    });
  });
}

/* ADD CONTACT */
async function addContact() {
  playSound("clickSound");

  const email = prompt("Email:");
  const users = await getDocs(collection(db,"users"));

  let found = null;
  users.forEach(u=>{
    if(u.data().email===email) found=u;
  });

  if(!found) return alert("Não encontrado");

  await addDoc(collection(db,"contacts"),{
    owner: currentUser.uid,
    contactId: found.id
  });

  loadContacts();
}

/* CHAT */
function getChatId(a,b){ return [a,b].sort().join("_"); }

function openChat(uid,name){
  currentChat = getChatId(currentUser.uid,uid);
  currentContactName = name;

  document.getElementById("chatTitle").innerText = name;

  listenMessages();
}

/* TYPING */
async function handleTyping(){
  if(!currentChat) return;

  await setDoc(doc(db,"typing",currentChat+"_"+currentUser.uid),{
    typing:true,
    time:Date.now()
  });

  clearTimeout(typingTimeout);

  typingTimeout=setTimeout(()=>{
    setDoc(doc(db,"typing",currentChat+"_"+currentUser.uid),{
      typing:false
    });
  },2000);
}

/* MESSAGES */
function listenMessages(){
  if(unsubscribe) unsubscribe();

  const el = document.getElementById("messages");

  unsubscribe = onSnapshot(query(collection(db,"messages",currentChat,"chat"),orderBy("timestamp")), snap=>{
    el.innerHTML="";

    snap.forEach(docSnap=>{
      const msg=docSnap.data();

      if(msg.type==="nudge"){
        shakeWindow();
        if(msg.sender!==currentUser.uid) playSound("nudgeSound");
        return;
      }

      const div=document.createElement("div");
      div.className = msg.sender===currentUser.uid ? "msg me":"msg";
      div.innerText = msg.text;

      if(msg.sender===currentUser.uid){
        const btn=document.createElement("button");
        btn.innerText="x";
        btn.className="delete-btn";
        btn.onclick=()=>deleteDoc(doc(db,"messages",currentChat,"chat",docSnap.id));
        div.appendChild(btn);
      }

      el.appendChild(div);
    });
  });

  /* TYPING VIEW */
  onSnapshot(collection(db,"typing"), snap=>{
    let typing=false;

    snap.forEach(d=>{
      if(d.id.startsWith(currentChat) && !d.id.endsWith(currentUser.uid) && d.data().typing){
        typing=true;
      }
    });

    document.getElementById("chatTitle").innerText = typing ? "Digitando..." : currentContactName;
  });
}

/* SEND */
async function sendMessage(){
  playSound("sendSound");

  const input=document.getElementById("messageInput");
  if(!input.value) return;

  await addDoc(collection(db,"messages",currentChat,"chat"),{
    text:input.value,
    sender:currentUser.uid,
    timestamp:serverTimestamp()
  });

  await setDoc(doc(db,"typing",currentChat+"_"+currentUser.uid),{typing:false});

  input.value="";
}

/* NUDGE */
async function sendNudge(){
  playSound("nudgeSound");

  await addDoc(collection(db,"messages",currentChat,"chat"),{
    type:"nudge",
    sender:currentUser.uid,
    timestamp:serverTimestamp()
  });
}

/* FX */
function shakeWindow(){
  const el=document.querySelector(".messenger-window");
  let i=0;
  const int=setInterval(()=>{
    el.style.transform=`translate(${i%2?6:-6}px,0)`;
    if(i++>10){clearInterval(int);el.style.transform="";}
  },40);
}
