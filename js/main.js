const placeSelect = document.querySelector("#place");
const sections = [
  document.querySelector("#map p"),
  document.querySelector("#chart p"),
  document.querySelector("#summary p")
];

function showPlace() {
  const placeName = placeSelect.selectedOptions[0].textContent;
  sections[0].textContent = "Fires for " + placeName + " will appear here.";
  sections[1].textContent = "AQI for " + placeName + " will appear here.";
  sections[2].textContent = "Trend for " + placeName + " will appear here.";
}

placeSelect.addEventListener("change", showPlace);
showPlace();
