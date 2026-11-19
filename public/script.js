console.log("Taj Portfolio loaded");

// =====================================
// HELPERS (security)
// =====================================

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Allow only valid https links (blocks javascript: and similar)
function safeUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
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

    if (!data.success) {
      throw new Error(data.message || "Failed to load projects");
    }

    const projectsGrid = document.querySelector(".projects-grid");

    if (!projectsGrid) {
      console.error(".projects-grid not found");
      return;
    }

    // Clear loading text
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

      const githubUrl = safeUrl(project.github_url);
      const liveUrl = safeUrl(project.live_url);

      projectCard.innerHTML = `
        <div class="project-number">
          ${String(index + 1).padStart(2, "0")}
        </div>

        <h3>${escapeHtml(project.title)}</h3>

        <p>
          ${escapeHtml(project.description)}
        </p>

        <div class="project-tags">
          ${
            project.technologies
              ? project.technologies
                  .split(",")
                  .map((tech) => tech.trim())
                  .filter(Boolean)
                  .map((tech) => `<span>${escapeHtml(tech)}</span>`)
                  .join("")
              : ""
          }
        </div>

        <div class="project-links">

          ${
            githubUrl
              ? `
                <a
                  href="${escapeHtml(githubUrl)}"
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
            liveUrl
              ? `
                <a
                  href="${escapeHtml(liveUrl)}"
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

// =====================================
// CONTACT FORM
// =====================================

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