// Web/netlify/functions/request.js

const { Octokit } = require("@octokit/rest");

exports.handler = async (event) => {
  console.log("🔔 Function hit! Method:", event.httpMethod);
  console.log("Body:", event.body);

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch (err) {
    console.error("❌ JSON inválido:", err);
    return { statusCode: 400, body: "Bad Request" };
  }
  const username = payload.username;
  if (!username) {
    return { statusCode: 400, body: "Missing username" };
  }

  // Inicializa Octokit con el token de entorno
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

  const owner = process.env.GITHUB_OWNER;
  const repo  = process.env.GITHUB_REPO;
  const path  = process.env.REQUESTS_PATH; // e.g. "Web/data/requests.json"
  try {
    // 1) Obtén el contenido actual de requests.json
    const { data: file } = await octokit.repos.getContent({
      owner, repo, path,
    });

    // El contenido viene en base64
    const content = Buffer.from(file.content, "base64").toString();
    let requests = [];
    try {
      requests = JSON.parse(content);
      if (!Array.isArray(requests)) requests = [];
    } catch {
      requests = [];
    }

    // 2) Añade el username si no existía
    if (!requests.includes(username)) {
      requests.push(username);
    } else {
      console.log(`⚠️ ${username} ya estaba en requests.json`);
    }

    const updatedContent = Buffer.from(
      JSON.stringify(requests, null, 2)
    ).toString("base64");

    // 3) Haz commit del archivo con el nuevo contenido
    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message: `chore: add ${username} to requests.json`,
      content: updatedContent,
      sha: file.sha,
    });

    console.log(`✅ Agregado ${username} a ${path}`);
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, username }),
    };
  } catch (err) {
    console.error("❌ Error en GitHub API:", err);
    return {
      statusCode: 500,
      body: "Internal Server Error",
    };
  }
};