// A failed CDN request or unavailable WebGL must leave a readable retry path.
try {
  await import("./main.js");
} catch (error) {
  console.error("[silo] Falha ao iniciar", error);
  document.getElementById("status").textContent = "Não foi possível iniciar o cenário. Verifique a conexão e o suporte a WebGL do navegador.";
  const button = document.getElementById("start-button");
  button.disabled = false;
  button.textContent = "Tentar novamente →";
  button.addEventListener("click", () => location.reload());
}
