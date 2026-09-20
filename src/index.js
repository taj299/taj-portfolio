export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // ===============================
    // ADMIN AUTHENTICATION
    // ===============================
    const isAdminPage =
      url.pathname === "/admin" || url.pathname.startsWith("/admin/");

    const isProtectedApi =
      url.pathname === "/api/stats" ||
      (url.pathname === "/api/messages" && request.method === "GET") ||
      (url.pathname.startsWith("/api/projects/") &&
        ["PUT", "DELETE"].includes(request.method)) ||
      (url.pathname === "/api/projects" && request.method === "POST");

    if (isAdminPage || isProtectedApi) {
      const auth = request.headers.get("Authorization");

      if (!auth || !auth.startsWith("Basic ")) {
        return new Response("Authentication required", {
          status: 401,
          headers: {
            "WWW-Authenticate": 'Basic realm="Taj Admin Panel"',
          },
        });
      }

      try {
        const encoded = auth.split(" ")[1];
        const decoded = atob(encoded);
        const separator = decoded.indexOf(":");

        if (separator === -1) {
          throw new Error("Invalid credentials format");
        }

        const username = decoded.slice(0, separator);
        const password = decoded.slice(separator + 1);

        if (username !== "admin" || password !== env.ADMIN_PASSWORD) {
          return new Response("Invalid credentials", {
            status: 401,
            headers: {
              "WWW-Authenticate": 'Basic realm="Taj Admin Panel"',
            },
          });
        }
      } catch (error) {
        return new Response("Invalid authentication", {
          status: 401,
          headers: {
            "WWW-Authenticate": 'Basic realm="Taj Admin Panel"',
          },
        });
      }
    }
    // -------------------------
    // COUNT PORTFOLIO VIEW
    // -------------------------
    if (url.pathname === "/api/view" && request.method === "POST") {
      await env.taj_portfolio_db
        .prepare("INSERT INTO views DEFAULT VALUES")
        .run();

      return Response.json({
        success: true,
        message: "View counted",
      });
    }

    // -------------------------
    // PORTFOLIO STATS
    // -------------------------
    if (url.pathname === "/api/stats" && request.method === "GET") {
      const result = await env.taj_portfolio_db
        .prepare("SELECT COUNT(*) AS total FROM views")
        .first();

      return Response.json({
        views: result?.total || 0,
      });
    }

    // -------------------------
    // GET ALL MESSAGES
    // -------------------------
    if (url.pathname === "/api/messages" && request.method === "GET") {
      try {
        const result = await env.taj_portfolio_db
          .prepare(
            `
        SELECT *
        FROM messages
        ORDER BY id DESC`,
          )
          .all();

        return Response.json({
          success: true,
          messages: result.results,
        });
      } catch (error) {
        console.error("Get messages error:", error);

        return Response.json(
          {
            success: false,
            message: "Failed to fetch messages",
          },
          { status: 500 },
        );
      }
    }

    // -------------------------
    // SEND MESSAGE
    // -------------------------
    if (url.pathname === "/api/messages" && request.method === "POST") {
      try {
        const data = await request.json();

        const name = data.name?.trim();
        const email = data.email?.trim();
        const message = data.message?.trim();

        if (!name || !email || !message) {
          return Response.json(
            {
              success: false,
              message: "All fields are required",
            },
            { status: 400 },
          );
        }

        await env.taj_portfolio_db
          .prepare(
            `INSERT INTO messages (name, email, message)
             VALUES (?, ?, ?)`,
          )
          .bind(name, email, message)
          .run();

        return Response.json({
          success: true,
          message: "Message sent successfully",
        });
      } catch (error) {
        return Response.json(
          {
            success: false,
            message: "Something went wrong",
          },
          { status: 500 },
        );
      }
    }
    // ===============================
    // GET SINGLE PROJECT
    // ===============================

    if (url.pathname.startsWith("/api/projects/") && request.method === "GET") {
      try {
        const id = url.pathname.split("/").pop();

        const project = await env.taj_portfolio_db
          .prepare("SELECT * FROM projects WHERE id = ?")
          .bind(id)
          .first();

        if (!project) {
          return Response.json(
            {
              success: false,
              message: "Project not found",
            },
            { status: 404 },
          );
        }

        return Response.json({
          success: true,
          project: project,
        });
      } catch (error) {
        console.error("Get project error:", error);

        return Response.json(
          {
            success: false,
            message: "Failed to fetch project",
          },
          { status: 500 },
        );
      }
    }
    // -------------------------
    // GET ALL PROJECTS
    // -------------------------
    if (url.pathname === "/api/projects" && request.method === "GET") {
      try {
        const result = await env.taj_portfolio_db
          .prepare(
            `SELECT *
             FROM projects
             ORDER BY id DESC`,
          )
          .all();

        return Response.json({
          success: true,
          projects: result.results,
        });
      } catch (error) {
        return Response.json(
          {
            success: false,
            message: "Failed to fetch projects",
          },
          { status: 500 },
        );
      }
    }

    // -------------------------
    // ADD PROJECT
    // -------------------------
    if (url.pathname === "/api/projects" && request.method === "POST") {
      try {
        const data = await request.json();

        const title = data.title?.trim();
        const description = data.description?.trim();
        const technologies = data.technologies?.trim() || "";
        const github_url = data.github_url?.trim() || "";
        const live_url = data.live_url?.trim() || "";

        if (!title || !description) {
          return Response.json(
            {
              success: false,
              message: "Title and description are required",
            },
            { status: 400 },
          );
        }

        const result = await env.taj_portfolio_db
          .prepare(
            `INSERT INTO projects
             (title, description, technologies, github_url, live_url)
             VALUES (?, ?, ?, ?, ?)`,
          )
          .bind(title, description, technologies, github_url, live_url)
          .run();

        return Response.json({
          success: true,
          message: "Project added successfully",
          id: result.meta.last_row_id,
        });
      } catch (error) {
        return Response.json(
          {
            success: false,
            message: "Failed to add project",
          },
          { status: 500 },
        );
      }
    }

    // -------------------------
    // UPDATE PROJECT
    // -------------------------
    if (url.pathname.startsWith("/api/projects/") && request.method === "PUT") {
      try {
        const id = url.pathname.split("/").pop();

        const data = await request.json();

        const title = data.title?.trim();
        const description = data.description?.trim();
        const technologies = data.technologies?.trim() || "";
        const github_url = data.github_url?.trim() || "";
        const live_url = data.live_url?.trim() || "";

        if (!title || !description) {
          return Response.json(
            {
              success: false,
              message: "Title and description are required",
            },
            { status: 400 },
          );
        }

        await env.taj_portfolio_db
          .prepare(
            `UPDATE projects
             SET title = ?,
                 description = ?,
                 technologies = ?,
                 github_url = ?,
                 live_url = ?
             WHERE id = ?`,
          )
          .bind(title, description, technologies, github_url, live_url, id)
          .run();

        return Response.json({
          success: true,
          message: "Project updated successfully",
        });
      } catch (error) {
        return Response.json(
          {
            success: false,
            message: "Failed to update project",
          },
          { status: 500 },
        );
      }
    }

    // -------------------------
    // DELETE PROJECT
    // -------------------------
    if (
      url.pathname.startsWith("/api/projects/") &&
      request.method === "DELETE"
    ) {
      try {
        const id = url.pathname.split("/").pop();

        await env.taj_portfolio_db
          .prepare("DELETE FROM projects WHERE id = ?")
          .bind(id)
          .run();

        return Response.json({
          success: true,
          message: "Project deleted successfully",
        });
      } catch (error) {
        return Response.json(
          {
            success: false,
            message: "Failed to delete project",
          },
          { status: 500 },
        );
      }
    }
    // Prevent admin pages from being cached
    if (isAdminPage) {
      const response = await env.ASSETS.fetch(request);

      const headers = new Headers(response.headers);
      headers.set("Cache-Control", "no-store, private");

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    return env.ASSETS.fetch(request);

    // -------------------------
    // SERVE PORTFOLIO
    // -------------------------
    return env.ASSETS.fetch(request);
  },
};
