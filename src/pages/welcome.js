const a = document.getElementById("instruction_link");
a.onclick = _ => {
  document.getElementById("instruction").toggleAttribute("hidden");

  // eslint-disable-next-line verify-await/check
  if (!navigator.oscpu.includes("Win")) {
    document.getElementById("for-win").hidden = true;
    document.getElementById("for-other").hidden = false;
  }
};
