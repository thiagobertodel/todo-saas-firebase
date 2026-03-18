import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";


const firebaseConfig = {
  apiKey: "*************",
  authDomain: "todo-saas-thiago.firebaseapp.com",
  projectId: "todo-saas-thiago",
  storageBucket: "*******************",
  messagingSenderId: "***************",
  appId: "**************"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth();
const provider = new GoogleAuthProvider();

let tasks = [];
let currentUser = null;
let editingTaskId = null;

const input = document.getElementById("taskInput");
const priorityInput = document.getElementById("priorityInput");
const list = document.getElementById("taskList");
const filter = document.getElementById("filter");
const userText = document.getElementById("user");
const emptyState = document.getElementById("emptyState");
const totalCount = document.getElementById("totalCount");
const doneCount = document.getElementById("doneCount");
const pendingCount = document.getElementById("pendingCount");
const loading = document.getElementById("loading");

function setLoading(isLoading) {
  loading.classList.toggle("hidden", !isLoading);
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getPriorityClass(priority) {
  if (priority === "alta") return "priority-alta";
  if (priority === "media") return "priority-media";
  return "priority-baixa";
}

function updateStats() {
  totalCount.textContent = tasks.length;
  doneCount.textContent = tasks.filter(task => task.done).length;
  pendingCount.textContent = tasks.filter(task => !task.done).length;
}

function getFilteredTasks() {
  if (filter.value === "done") return tasks.filter(task => task.done);
  if (filter.value === "pending") return tasks.filter(task => !task.done);
  if (filter.value === "high") return tasks.filter(task => task.priority === "alta");
  return tasks;
}

function renderTasks() {
  list.innerHTML = "";

  const filteredTasks = getFilteredTasks();

  if (filteredTasks.length === 0) {
    emptyState.classList.remove("hidden");
  } else {
    emptyState.classList.add("hidden");
  }

  filteredTasks.forEach(task => {
    const li = document.createElement("li");
    li.className = "task-item";

    const isEditing = editingTaskId === task.id;

    if (isEditing) {
      li.innerHTML = `
        <div class="edit-area">
          <input
            id="edit-${task.id}"
            class="edit-input"
            type="text"
            value="${escapeHtml(task.text)}"
          >

          <select id="edit-priority-${task.id}" class="edit-priority">
            <option value="baixa" ${task.priority === "baixa" ? "selected" : ""}>Prioridade baixa</option>
            <option value="media" ${task.priority === "media" ? "selected" : ""}>Prioridade média</option>
            <option value="alta" ${task.priority === "alta" ? "selected" : ""}>Prioridade alta</option>
          </select>

          <button class="save-btn" onclick="saveEdit('${task.id}')">Salvar</button>
          <button class="cancel-btn" onclick="cancelEdit()">Cancelar</button>
        </div>
      `;
    } else {
      li.innerHTML = `
        <input
          class="task-check"
          type="checkbox"
          ${task.done ? "checked" : ""}
          onclick="toggleTask('${task.id}', ${task.done})"
        >

        <div class="task-main">
          <p class="task-text ${task.done ? "done" : ""}">${escapeHtml(task.text)}</p>
          <p class="task-status">
            <span>${task.done ? "Concluída" : "Pendente"}</span>
            <span class="priority-badge ${getPriorityClass(task.priority || "media")}">
              ${task.priority ? `Prioridade ${task.priority}` : "Prioridade média"}
            </span>
          </p>
        </div>

        <div class="task-actions">
          <button onclick="startEdit('${task.id}')">✏️</button>
          <button class="delete-btn" onclick="deleteTask('${task.id}')">🗑️</button>
        </div>
      `;
    }

    list.appendChild(li);
  });
}

async function loadTasks() {
  if (!currentUser) {
    tasks = [];
    renderTasks();
    updateStats();
    return;
  }

  setLoading(true);

  try {
    const tasksRef = collection(db, "tasks");
    const tasksQuery = query(tasksRef, where("userId", "==", currentUser.uid));
    const snapshot = await getDocs(tasksQuery);

    tasks = snapshot.docs
      .map(item => ({
        id: item.id,
        ...item.data()
      }))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    renderTasks();
    updateStats();
  } catch (error) {
    console.error("Erro ao carregar tarefas:", error);
    alert("Erro ao carregar tarefas.");
  } finally {
    setLoading(false);
  }
}

async function login() {
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error("Erro no login:", error);
    alert("Não foi possível fazer login.");
  }
}

async function logout() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Erro ao sair:", error);
    alert("Não foi possível sair.");
  }
}

async function addTask() {
  if (!currentUser) {
    alert("Faça login primeiro.");
    return;
  }

  const text = input.value.trim();
  const priority = priorityInput.value;

  if (text === "") return;

  setLoading(true);

  try {
    await addDoc(collection(db, "tasks"), {
      text,
      done: false,
      priority,
      userId: currentUser.uid,
      createdAt: Date.now()
    });

    input.value = "";
    priorityInput.value = "media";
    await loadTasks();
  } catch (error) {
    console.error("Erro ao adicionar tarefa:", error);
    alert("Erro ao adicionar tarefa.");
  } finally {
    setLoading(false);
  }
}

async function toggleTask(id, done) {
  setLoading(true);

  try {
    const ref = doc(db, "tasks", id);

    await updateDoc(ref, {
      done: !done
    });

    await loadTasks();
  } catch (error) {
    console.error("Erro ao atualizar tarefa:", error);
    alert("Erro ao atualizar tarefa.");
  } finally {
    setLoading(false);
  }
}

async function deleteTask(id) {
  setLoading(true);

  try {
    const ref = doc(db, "tasks", id);
    await deleteDoc(ref);

    if (editingTaskId === id) {
      editingTaskId = null;
    }

    await loadTasks();
  } catch (error) {
    console.error("Erro ao deletar tarefa:", error);
    alert("Erro ao deletar tarefa.");
  } finally {
    setLoading(false);
  }
}

function startEdit(id) {
  editingTaskId = id;
  renderTasks();
}

function cancelEdit() {
  editingTaskId = null;
  renderTasks();
}

async function saveEdit(id) {
  const editInput = document.getElementById(`edit-${id}`);
  const editPriority = document.getElementById(`edit-priority-${id}`);

  const newText = editInput.value.trim();
  const newPriority = editPriority.value;

  if (newText === "") {
    alert("A tarefa não pode ficar vazia.");
    return;
  }

  setLoading(true);

  try {
    const ref = doc(db, "tasks", id);

    await updateDoc(ref, {
      text: newText,
      priority: newPriority
    });

    editingTaskId = null;
    await loadTasks();
  } catch (error) {
    console.error("Erro ao editar tarefa:", error);
    alert("Erro ao editar tarefa.");
  } finally {
    setLoading(false);
  }
}

onAuthStateChanged(auth, async user => {
  currentUser = user;

  if (currentUser) {
    userText.innerText = `Logado como: ${currentUser.email}`;
    await loadTasks();
  } else {
    userText.innerText = "Você ainda não fez login.";
    tasks = [];
    editingTaskId = null;
    renderTasks();
    updateStats();
  }
});

input.addEventListener("keypress", event => {
  if (event.key === "Enter") {
    addTask();
  }
});

filter.addEventListener("change", renderTasks);

window.login = login;
window.logout = logout;
window.addTask = addTask;
window.toggleTask = toggleTask;
window.deleteTask = deleteTask;
window.startEdit = startEdit;
window.cancelEdit = cancelEdit;
window.saveEdit = saveEdit;
