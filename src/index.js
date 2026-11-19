const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: JSON_HEADERS,
  });
}

function error(message, status = 400) {
  return json({ success: false, message }, status);
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidHttpsUrl(value) {
  if (!value) return true;

  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

async function readJson(request) {
  const contentType = request.headers.get("Content-Type") || "";

  if (!contentType.toLowerCase().includes("application/json")) {
    return {
      ok: false,
      response: error("Content-Type must be application/json", 415),
    };
  }

  try {
    const data = await request.json();

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return { ok: false, response: error("Invalid JSON body", 400) };
    }

    return { ok: true, data };
  } catch {
    return { ok: false, response: error("Invalid JSON body", 400) };
  }
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function validProjectId(pathname) {
  const match = pathname.match(/^\/api\/projects\/(\d+)$/);
  if (!match) return null;

  const id = Number(match[1]);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function validMessageId(pathname) {
  const match = pathname.match(/^\/api\/messages\/(\d+)$/);
  if (!match) return null;

  const id = Number(match[1]);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

async function authenticateAdmin(request, env) {
  // ADMIN_PASSWORD must be configured as a Cloudflare Worker secret.
  if (!env.ADMIN_PASSWORD) {
    console.error("ADMIN_PASSWORD Worker secret is not configured");
    return false;
  }

  const auth = request.headers.get("Authorization") || "";
  if (!auth.startsWith("Basic ")) return false;

  try {
    const encoded = auth.slice(6).trim();
    const decoded = atob(encoded);
    const separator = decoded.indexOf(":");

    if (separator < 0) return false;

    const username = decoded.slice(0, separator);
    const password = decoded.slice(separator + 1);

    return username === "admin" && password === env.ADMIN_PASSWORD;
  } catch {
    return false;
  }
}

function unauthorized() {
  return new Response("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Taj Admin Panel", charset="UTF-8"',
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function withSecurityHeaders(response, { admin = false } = {}) {
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Frame-Options", "DENY");

  if (admin) {
    headers.set("Cache-Control", "no-store, private");
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const method = request.method;

    const isAdminPage = pathname === "/admin" || pathname.startsWith("/admin/");

    const isProtectedApi =
      (pathname === "/api/stats" && method === "GET") ||
      (pathname === "/api/messages" && method === "GET") ||
      (validMessageId(pathname) !== null && method === "DELETE") ||
      (pathname === "/api/projects" && method === "POST") ||
      (pathname === "/api/admin/resume" && method === "PUT") ||
      (pathname === "/api/admin/resume/info" && method === "GET") ||
      (validProjectId(pathname) !== null && ["PUT", "DELETE"].includes(method));
    // Protect admin pages and private APIs.
    if (isAdminPage || isProtectedApi) {
      const authenticated = await authenticateAdmin(request, env);

      if (!authenticated) {
        return unauthorized();
      }
    }

    // Upload or replace resume (admin only).
    if (pathname === "/api/admin/resume" && method === "PUT") {
      try {
        if (!env.RESUME_STORAGE) {
          return error("Resume storage is not configured", 503);
        }

        const contentType = request.headers.get("Content-Type") || "";

        if (!contentType.toLowerCase().includes("multipart/form-data")) {
          return error("Upload must use multipart/form-data", 415);
        }

        const contentLength = request.headers.get("Content-Length");

        if (contentLength !== null) {
          const size = Number(contentLength);

          if (
            !Number.isSafeInteger(size) ||
            size <= 0 ||
            size > 6 * 1024 * 1024
          ) {
            return error("Upload request must not exceed 6 MB", 413);
          }
        }

        const formData = await request.formData();
        const file = formData.get("resume");

        if (!file || typeof file.arrayBuffer !== "function") {
          return error("Please select a resume file", 400);
        }

        if (file.size === 0 || file.size > 5 * 1024 * 1024) {
          return error("File must be between 1 byte and 5 MB", 413);
        }

        const extension = (file.name || "").split(".").pop().toLowerCase();

        const allowedTypes = {
          pdf: "application/pdf",
          doc: "application/msword",
          docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          txt: "text/plain",
        };

        if (!Object.prototype.hasOwnProperty.call(allowedTypes, extension)) {
          return error("Only PDF, DOC, DOCX and TXT files are allowed", 400);
        }

        const bytes = await file.arrayBuffer();
        const signature = new Uint8Array(bytes.slice(0, 8));

        if (extension === "pdf") {
          if (
            signature[0] !== 0x25 ||
            signature[1] !== 0x50 ||
            signature[2] !== 0x44 ||
            signature[3] !== 0x46 ||
            signature[4] !== 0x2d
          ) {
            return error("Invalid PDF file", 400);
          }
        }

        if (extension === "doc") {
          const docSignature = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
          if (!docSignature.every((byte, index) => signature[index] === byte)) {
            return error("Invalid DOC file", 400);
          }
        }

        if (extension === "docx") {
          if (
            signature[0] !== 0x50 ||
            signature[1] !== 0x4b ||
            signature[2] !== 0x03 ||
            signature[3] !== 0x04
          ) {
            return error("Invalid DOCX file", 400);
          }
        }

        if (extension === "txt") {
          try {
            new TextDecoder("utf-8", { fatal: true }).decode(bytes);
          } catch {
            return error("TXT file must contain valid UTF-8 text", 400);
          }
        }

        const storedFileName = `Taj_Resume.${extension}`;

        await env.RESUME_STORAGE.put("resume:current", bytes, {
          metadata: {
            fileName: storedFileName,
            contentType: allowedTypes[extension],
            updatedAt: new Date().toISOString(),
          },
        });

        return json({
          success: true,
          message: "Resume uploaded successfully",
          fileName: storedFileName,
        });
      } catch (err) {
        console.error("Resume upload error:", err);
        return error("Unable to upload resume", 500);
      }
    }

    // Current resume details for the admin panel (admin only).
    if (pathname === "/api/admin/resume/info" && method === "GET") {
      try {
        if (!env.RESUME_STORAGE) {
          return error("Resume storage is not configured", 503);
        }

        // list() returns metadata without reading the file itself.
        const listed = await env.RESUME_STORAGE.list({
          prefix: "resume:current",
        });

        const entry = listed.keys.find((key) => key.name === "resume:current");

        if (!entry) {
          return json({ success: true, exists: false });
        }

        return json({
          success: true,
          exists: true,
          fileName: entry.metadata?.fileName || "Taj_Resume.pdf",
          contentType: entry.metadata?.contentType || "application/pdf",
          updatedAt: entry.metadata?.updatedAt || null,
        });
      } catch (err) {
        console.error("Resume info error:", err);
        return error("Unable to load resume details", 500);
      }
    }

    // Download the latest resume.
    if (pathname === "/api/resume" && method === "GET") {
      try {
        if (!env.RESUME_STORAGE) {
          return error("Resume storage is not configured", 503);
        }

        const stored = await env.RESUME_STORAGE.getWithMetadata(
          "resume:current",
          {
            type: "arrayBuffer",
          },
        );
        if (!stored || !stored.value) {
          return error("No uploaded resume found", 404);
        }

        const fileName = stored.metadata?.fileName || "Taj_Resume.pdf";
        const contentType = stored.metadata?.contentType || "application/pdf";

        return new Response(stored.value, {
          status: 200,
          headers: {
            "Content-Type": contentType,
            "Content-Disposition": `attachment; filename="${fileName}"`,
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
          },
        });
      } catch (err) {
        console.error("Resume download error:", err);
        return error("Unable to download resume", 500);
      }
    }

    // Count public portfolio views.
    if (pathname === "/api/view" && method === "POST") {
      try {
        await env.taj_portfolio_db
          .prepare("INSERT INTO views DEFAULT VALUES")
          .run();

        return withSecurityHeaders(
          json({
            success: true,
            message: "View counted",
          }),
        );
      } catch (err) {
        console.error("Count view error:", err);
        return error("Unable to count portfolio view", 500);
      }
    }

    // Admin dashboard statistics.
    if (pathname === "/api/stats" && method === "GET") {
      try {
        const result = await env.taj_portfolio_db
          .prepare("SELECT COUNT(*) AS total FROM views")
          .first();

        return json({
          views: result?.total || 0,
        });
      } catch (err) {
        console.error("Get stats error:", err);
        return error("Failed to fetch statistics", 500);
      }
    }
    // Get all contact messages (admin only).
    if (pathname === "/api/messages" && method === "GET") {
      try {
        const result = await env.taj_portfolio_db
          .prepare("SELECT * FROM messages ORDER BY id DESC")
          .all();

        return json({
          success: true,
          messages: result.results || [],
        });
      } catch (err) {
        console.error("Get messages error:", err);
        return error("Failed to fetch messages", 500);
      }
    }

    // Receive a public contact form message.
    if (pathname === "/api/messages" && method === "POST") {
      const parsed = await readJson(request);
      if (!parsed.ok) return parsed.response;

      const name = cleanString(parsed.data.name);
      const email = cleanString(parsed.data.email).toLowerCase();
      const message = cleanString(parsed.data.message);

      if (!name || !email || !message) {
        return error("All fields are required", 400);
      }

      if (name.length > 100) {
        return error("Name must be 100 characters or fewer", 400);
      }

      if (email.length > 254 || !isValidEmail(email)) {
        return error("Please provide a valid email address", 400);
      }

      if (message.length < 10 || message.length > 5000) {
        return error("Message must be between 10 and 5000 characters", 400);
      }

      try {
        await env.taj_portfolio_db
          .prepare(
            `INSERT INTO messages (name, email, message)
             VALUES (?, ?, ?)`,
          )
          .bind(name, email, message)
          .run();

        return json({
          success: true,
          message: "Message sent successfully",
        });
      } catch (err) {
        console.error("Save contact message error:", err);
        return error("Unable to send your message right now", 500);
      }
    }

    // Delete a contact message (admin only).
    const messageId = validMessageId(pathname);

    if (messageId !== null && method === "DELETE") {
      try {
        const result = await env.taj_portfolio_db
          .prepare("DELETE FROM messages WHERE id = ?")
          .bind(messageId)
          .run();

        if (!result.meta?.changes) {
          return error("Message not found", 404);
        }

        return json({
          success: true,
          message: "Message deleted successfully",
        });
      } catch (err) {
        console.error("Delete message error:", err);
        return error("Failed to delete message", 500);
      }
    }

    // Get one project by numeric ID.
    const projectId = validProjectId(pathname);

    if (projectId !== null && method === "GET") {
      try {
        const project = await env.taj_portfolio_db
          .prepare("SELECT * FROM projects WHERE id = ?")
          .bind(projectId)
          .first();

        if (!project) {
          return error("Project not found", 404);
        }

        return json({
          success: true,
          project,
        });
      } catch (err) {
        console.error("Get project error:", err);
        return error("Failed to fetch project", 500);
      }
    }

    // Get all public projects.
    if (pathname === "/api/projects" && method === "GET") {
      try {
        const result = await env.taj_portfolio_db
          .prepare("SELECT * FROM projects ORDER BY id DESC")
          .all();

        return json({
          success: true,
          projects: result.results || [],
        });
      } catch (err) {
        console.error("Get projects error:", err);
        return error("Failed to fetch projects", 500);
      }
    }
    // Add a project (admin only).
    if (pathname === "/api/projects" && method === "POST") {
      const parsed = await readJson(request);
      if (!parsed.ok) return parsed.response;

      const title = cleanString(parsed.data.title);
      const description = cleanString(parsed.data.description);
      const technologies = cleanString(parsed.data.technologies);
      const githubUrl = cleanString(parsed.data.github_url);
      const liveUrl = cleanString(parsed.data.live_url);

      if (!title || !description) {
        return error("Title and description are required", 400);
      }

      if (title.length > 150 || description.length > 5000) {
        return error("Title or description is too long", 400);
      }

      if (technologies.length > 500) {
        return error("Technologies must be 500 characters or fewer", 400);
      }

      if (!isValidHttpsUrl(githubUrl) || !isValidHttpsUrl(liveUrl)) {
        return error("Project links must be valid HTTPS URLs", 400);
      }

      try {
        const result = await env.taj_portfolio_db
          .prepare(
            `INSERT INTO projects
             (title, description, technologies, github_url, live_url)
             VALUES (?, ?, ?, ?, ?)`,
          )
          .bind(title, description, technologies, githubUrl, liveUrl)
          .run();

        return json({
          success: true,
          message: "Project added successfully",
          id: result.meta?.last_row_id,
        });
      } catch (err) {
        console.error("Add project error:", err);
        return error("Failed to add project", 500);
      }
    }

    // Update a project (admin only).
    if (projectId !== null && method === "PUT") {
      const parsed = await readJson(request);
      if (!parsed.ok) return parsed.response;

      const title = cleanString(parsed.data.title);
      const description = cleanString(parsed.data.description);
      const technologies = cleanString(parsed.data.technologies);
      const githubUrl = cleanString(parsed.data.github_url);
      const liveUrl = cleanString(parsed.data.live_url);

      if (!title || !description) {
        return error("Title and description are required", 400);
      }

      if (title.length > 150 || description.length > 5000) {
        return error("Title or description is too long", 400);
      }

      if (technologies.length > 500) {
        return error("Technologies must be 500 characters or fewer", 400);
      }

      if (!isValidHttpsUrl(githubUrl) || !isValidHttpsUrl(liveUrl)) {
        return error("Project links must be valid HTTPS URLs", 400);
      }

      try {
        const result = await env.taj_portfolio_db
          .prepare(
            `UPDATE projects
             SET title = ?,
                 description = ?,
                 technologies = ?,
                 github_url = ?,
                 live_url = ?
             WHERE id = ?`,
          )
          .bind(title, description, technologies, githubUrl, liveUrl, projectId)
          .run();

        if (!result.meta?.changes) {
          return error("Project not found", 404);
        }

        return json({
          success: true,
          message: "Project updated successfully",
        });
      } catch (err) {
        console.error("Update project error:", err);
        return error("Failed to update project", 500);
      }
    }

    // Delete a project (admin only).
    if (projectId !== null && method === "DELETE") {
      try {
        const result = await env.taj_portfolio_db
          .prepare("DELETE FROM projects WHERE id = ?")
          .bind(projectId)
          .run();

        if (!result.meta?.changes) {
          return error("Project not found", 404);
        }

        return json({
          success: true,
          message: "Project deleted successfully",
        });
      } catch (err) {
        console.error("Delete project error:", err);
        return error("Failed to delete project", 500);
      }
    }

    // Serve admin assets without browser caching.
    if (isAdminPage) {
      const response = await env.ASSETS.fetch(request);
      return withSecurityHeaders(response, { admin: true });
    }

    // Serve public portfolio assets.
    const response = await env.ASSETS.fetch(request);
    return withSecurityHeaders(response);
  },
};
