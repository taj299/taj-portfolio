// ===============================
// ADMIN DASHBOARD
// ===============================

// ===============================
// DASHBOARD STATS
// ===============================

async function loadStats() {
  try {
    const response = await fetch("/api/stats");
    const data = await response.json();

    const statCards = document.querySelectorAll(".card");

    if (statCards.length > 0) {
      const viewsNumber = statCards[0].querySelector("strong");

      if (viewsNumber) {
        viewsNumber.textContent = data.views ?? 0;
      }
    }
  } catch (error) {
    console.error("Failed to load dashboard stats:", error);
  }
}

// ===============================
// LOAD PROJECTS
// ===============================

async function loadProjects() {
  try {
    const response = await fetch("/api/projects");
    const data = await response.json();

    console.log("Projects API response:", data);

    if (!data.success) {
      console.error("Failed to load projects");
      return;
    }

    const projectList = document.querySelector(".project-list");

    if (!projectList) {
      console.error("Project list not found");
      return;
    }

    projectList.innerHTML = "";

    if (!data.projects || data.projects.length === 0) {
      projectList.innerHTML = `
                <p>No projects found.</p>`;
      return;
    }

    data.projects.forEach((project) => {
      const projectElement = document.createElement("div");

      projectElement.className = "project";

      projectElement.innerHTML = `
                <div class="project-info">
                    <h3>${project.title}</h3>
                    <p>${project.technologies || ""}</p>
                </div>

                <div class="project-actions">

                    <button
                        class="edit-btn"
                        onclick="editProject(${project.id})">
                        Edit
                    </button>

                    <button
                        class="delete-btn"
                        onclick="deleteProject(${project.id})">
                        Delete
                    </button>

                </div>
            `;

      projectList.appendChild(projectElement);
    });
  } catch (error) {
    console.error("Failed to load projects:", error);
  }
}

// ===============================
// PROJECT FORM
// ===============================

const addProjectBtn = document.getElementById("addProjectBtn");

const quickAddProjectBtn = document.getElementById("quickAddProjectBtn");

const projectFormPanel = document.getElementById("projectFormPanel");

const projectForm = document.getElementById("projectForm");

const cancelProjectBtn = document.getElementById("cancelProjectBtn");

// This stores the project ID while editing.
// null = Add mode
// number = Edit mode

let editingProjectId = null;

// ===============================
// SHOW FORM
// ===============================

function showProjectForm() {
  if (!projectFormPanel) return;

  projectFormPanel.style.display = "block";

  projectFormPanel.scrollIntoView({
    behavior: "smooth",
  });
}

// ===============================
// HIDE FORM
// ===============================
function hideProjectForm() {
  if (!projectFormPanel) return;

  projectFormPanel.style.display = "none";

  if (projectForm) {
    projectForm.reset();
  }

  editingProjectId = null;

  // Reset heading
  const heading = projectFormPanel.querySelector("h2");

  if (heading) {
    heading.textContent = "Add New Project";
  }

  // Reset description
  const description = projectFormPanel.querySelector(".panel-header p");

  if (description) {
    description.textContent = "Add a project to your portfolio";
  }

  // Reset submit button
  const submitButton = projectForm?.querySelector('button[type="submit"]');

  if (submitButton) {
    submitButton.textContent = "Add Project";
  }
}

// ===============================
// ADD BUTTONS
// ===============================

function startAddProject() {
  // Switch to ADD mode
  editingProjectId = null;

  // Clear all form fields
  if (projectForm) {
    projectForm.reset();
  }

  // Reset heading
  const heading = projectFormPanel?.querySelector("h2");

  if (heading) {
    heading.textContent = "Add New Project";
  }

  // Reset description text
  const description = projectFormPanel?.querySelector(".panel-header p");

  if (description) {
    description.textContent = "Add a project to your portfolio";
  }

  // Reset submit button
  const submitButton = projectForm?.querySelector('button[type="submit"]');

  if (submitButton) {
    submitButton.textContent = "Add Project";
  }

  // Show form
  showProjectForm();
}

// + Add Project button
addProjectBtn?.addEventListener("click", startAddProject);

// Quick Add Project button
quickAddProjectBtn?.addEventListener("click", startAddProject);

// Cancel button
cancelProjectBtn?.addEventListener("click", hideProjectForm);

// ===============================
// EDIT PROJECT
// ===============================

async function editProject(id) {
  try {
    const response = await fetch(`/api/projects/${id}`);
    const data = await response.json();

    console.log("Project for edit:", data);

    if (!data.success || !data.project) {
      alert("Failed to load project");
      return;
    }

    const project = data.project;

    editingProjectId = id;

    document.getElementById("projectTitle").value = project.title || "";

    document.getElementById("projectDescription").value =
      project.description || "";

    document.getElementById("projectTechnologies").value =
      project.technologies || "";

    document.getElementById("projectGithub").value = project.github_url || "";

    document.getElementById("projectLive").value = project.live_url || "";

    const formPanel = document.getElementById("projectFormPanel");

    formPanel.style.display = "block";

    formPanel.scrollIntoView({
      behavior: "smooth",
    });

    const heading = formPanel.querySelector("h2");

    if (heading) {
      heading.textContent = "Edit Project";
    }

    const description = formPanel.querySelector(".panel-header p");

    if (description) {
      description.textContent = "Update your portfolio project";
    }

    const submitButton = document.querySelector(
      "#projectForm button[type='submit']",
    );

    if (submitButton) {
      submitButton.textContent = "Update Project";
    }
  } catch (error) {
    console.error("Failed to load project:", error);

    alert("Failed to load project");
  }
}

// Make function available to onclick=""
window.editProject = editProject;

// ===============================
// DELETE PROJECT
// ===============================

async function deleteProject(id) {
  const confirmed = confirm("Are you sure you want to delete this project?");

  if (!confirmed) {
    return;
  }

  try {
    const response = await fetch(`/api/projects/${id}`, {
      method: "DELETE",
    });

    const data = await response.json();

    console.log("Delete project response:", data);

    if (!response.ok || !data.success) {
      alert(data.message || "Failed to delete project");

      return;
    }

    alert("Project deleted successfully!");

    // Reload projects
    await loadProjects();
  } catch (error) {
    console.error("Failed to delete project:", error);

    alert("Something went wrong while deleting the project.");
  }
}

// Make function available to onclick=""
window.deleteProject = deleteProject;

// ===============================
// SUBMIT PROJECT
// ===============================

projectForm?.addEventListener("submit", async function (event) {
  event.preventDefault();

  const title = document.getElementById("projectTitle").value.trim();

  const description = document
    .getElementById("projectDescription")
    .value.trim();

  const technologies = document
    .getElementById("projectTechnologies")
    .value.trim();

  const github_url = document.getElementById("projectGithub").value.trim();

  const live_url = document.getElementById("projectLive").value.trim();

  // ===========================
  // VALIDATION
  // ===========================

  if (!title || !description) {
    alert("Project title and description are required.");

    return;
  }

  try {
    let response;

    // ===========================
    // EDIT MODE
    // ===========================

    if (editingProjectId !== null) {
      response = await fetch(`/api/projects/${editingProjectId}`, {
        method: "PUT",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          title,
          description,
          technologies,
          github_url,
          live_url,
        }),
      });
    }

    // ===========================
    // ADD MODE
    // ===========================
    else {
      response = await fetch("/api/projects", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          title,
          description,
          technologies,
          github_url,
          live_url,
        }),
      });
    }

    const data = await response.json();

    console.log("Project save response:", data);

    if (!response.ok || !data.success) {
      alert(data.message || "Failed to save project");

      return;
    }

    // ===========================
    // SUCCESS
    // ===========================

    if (editingProjectId !== null) {
      alert("Project updated successfully!");
    } else {
      alert("Project added successfully!");
    }

    // Hide form
    hideProjectForm();

    // Reload projects from D1
    await loadProjects();
  } catch (error) {
    console.error("Failed to save project:", error);

    alert("Something went wrong while saving the project.");
  }
});

// ===============================
// INITIAL LOAD
// ===============================

document.addEventListener("DOMContentLoaded", () => {
  loadStats();
  loadProjects();
  loadMessages();

});

// ===============================
// COUNT PORTFOLIO VIEW
// ===============================

async function countPortfolioView() {
  try {
    await fetch("/api/view", {
      method: "POST",
    });

    console.log("Portfolio view counted");
  } catch (error) {
    console.error("Failed to count portfolio view:", error);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  countPortfolioView();
});

// ===============================
// LOAD MESSAGES
// ===============================

async function loadMessages() {

    try {

        const response = await fetch("/api/messages");
        const data = await response.json();

        console.log("Messages API response:", data);

        if (!data.success) {
            console.error("Failed to load messages");
            return;
        }

        const messageList = document.querySelector("#messageList");
        const messageCount = document.querySelector("#messageCount");

        if (!messageList) return;

        const messages = data.messages || [];

        // Update count
        if (messageCount) {
            messageCount.textContent = messages.length;
        }

        // No messages
        if (messages.length === 0) {

            messageList.innerHTML = `
                <p>No messages yet.</p>
            `;

            return;
        }

        // Display messages
        messageList.innerHTML = "";

        messages.forEach((message) => {

            const messageElement = document.createElement("div");

            messageElement.className = "message";

            messageElement.innerHTML = `
                <div class="message-info">

                    <h3>${message.name}</h3>

                    <p>
                        <strong>Email:</strong>
                        ${message.email}
                    </p>

                    <p>
                        ${message.message}
                    </p>

                </div>
            `;

            messageList.appendChild(messageElement);

        });

    } catch (error) {

        console.error("Failed to load messages:", error);

    }
}