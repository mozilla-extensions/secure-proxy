const globeEl = document.querySelector("#stateIcon");
const ringsEl = document.querySelector("#stateAnimation");

const GLOBE_SPEED = 1;
const RING_SPEED = 0.5;
// Added via global script tag on popup.html
const bodymovin = window.bodymovin;

const globeAnimation = bodymovin.loadAnimation({
  container: globeEl,
  renderer: "svg",
  loop: false,
  autoplay: false,
  path: "/img/globe.json",
  initialSegment: [89, 90],
});

const ringAnimation = bodymovin.loadAnimation({
  container: ringsEl,
  renderer: "svg",
  loop: true,
  autoplay: false,
  path: "/img/rings.json",
});

export const animateGlobe = (segment) => {
  globeAnimation.setSpeed(GLOBE_SPEED);
  globeAnimation.playSegments(segment, false);
};

export const animateRings = (show) => {
  if (show) {
    ringsEl.removeAttribute("hidden");
    ringAnimation.setSpeed(RING_SPEED);
    ringAnimation.play();
  } else {
    ringsEl.setAttribute("hidden", "");
  }
};
