console.log("Taj Portfolio loaded");

// =====================================
// LOGOUT BUTTON
// =====================================

const logoutButton = document.querySelector(".logout-btn");

if (logoutButton) {
  logoutButton.addEventListener("click", function () {
    alert("Logout functionality will be added later.");
  });
}

// =====================================
// ADMIN ADD PROJECT BUTTON
// =====================================

const addProjectButton = document.querySelector(".add-btn");

if (addProjectButton) {
  addProjectButton.addEventListener("click", function () {
    alert("Project management is available in Admin Panel.");
  });
}

// =====================================
// TRACK PORTFOLIO VIEW
// =====================================

if (!sessionStorage.getItem("portfolio_view_counted")) {
  fetch("/api/view", {
    method: "POST",
  })
    .then(() => {
      sessionStorage.setItem("portfolio_view_counted", "true");
    })
    .catch((error) => {
      console.error("View tracking failed:", error);
    });
}

// =====================================
// LOAD PROJECTS FROM D1
// =====================================

async function loadProjects() {
  try {
    const response = await fetch("/api/projects");

    if (!response.ok) {
      throw new Error("Projects API request failed");
    }

    const data = await response.json();

    console.log("Portfolio Projects API:", data);

    if (!data.success) {
      throw new Error(data.message || "Failed to load projects");
    }

    const projectsGrid = document.querySelector(".projects-grid");

    if (!projectsGrid) {
      console.error(".projects-grid not found");
      return;
    }

    // Clear existing static projects
    projectsGrid.innerHTML = "";

    // No projects
    if (!data.projects || data.projects.length === 0) {
      projectsGrid.innerHTML = `
        <p>No projects available yet.</p>
      `;
      return;
    }

    // Create projects from D1
    data.projects.forEach((project, index) => {
      const projectCard = document.createElement("div");

      projectCard.className = "project-card";

      projectCard.innerHTML = `
        <div class="project-number">
          ${String(index + 1).padStart(2, "0")}
        </div>

        <h3>${project.title || ""}</h3>

        <p>
          ${project.description || ""}
        </p>

        <div class="project-tags">
          ${
            project.technologies
              ? project.technologies
                  .split(",")
                  .map((tech) => `<span>${tech.trim()}</span>`)
                  .join("")
              : ""
          }
        </div>

        <div class="project-links">

          ${
            project.github_url
              ? `
                <a
                  href="${project.github_url}"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="project-btn"
                >
                  💻 GitHub
                </a>
              `
              : ""
          }

          ${
            project.live_url
              ? `
                <a
                  href="${project.live_url}"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="project-btn"
                >
                  🚀 Live Demo
                </a>
              `
              : ""
          }

        </div>
      `;

      projectsGrid.appendChild(projectCard);
    });
  } catch (error) {
    console.error("Failed to load portfolio projects:", error);

    const projectsGrid = document.querySelector(".projects-grid");

    if (projectsGrid) {
      projectsGrid.innerHTML = `
        <p>Unable to load projects.</p>
      `;
    }
  }
}

// =====================================
// INITIAL LOAD
// =====================================

document.addEventListener("DOMContentLoaded", () => {
  loadProjects();
});

// ===== CONTACT FORM =====

const contactForm = document.getElementById("contactForm");
const contactStatus = document.getElementById("contactStatus");

if (contactForm) {
  contactForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const name = document.getElementById("contactName").value.trim();
    const email = document.getElementById("contactEmail").value.trim();
    const message = document.getElementById("contactMessage").value.trim();

    if (!name || !email || !message) {
      contactStatus.textContent = "Please fill all fields.";
      return;
    }

    const submitButton = contactForm.querySelector("button[type='submit']");

    submitButton.disabled = true;
    submitButton.textContent = "Sending...";

    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name,
          email: email,
          message: message,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        contactStatus.textContent = "✅ Message sent successfully!";

        contactForm.reset();
      } else {
        contactStatus.textContent =
          "❌ " + (data.message || "Failed to send message.");
      }
    } catch (error) {
      console.error("Contact form error:", error);

      contactStatus.textContent = "❌ Something went wrong. Please try again.";
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "📩 Send Message";
    }
  });
}
