const a = document.getElementById("instruction_link");
a.onclick = _ => {
  document.getElementById("instruction").toggleAttribute('hidden');

  if(!navigator.oscpu.includes("Win")){
    document.getElementById("for-win").hidden = true;
    document.getElementById("for-other").hidden = false;
  }
}
