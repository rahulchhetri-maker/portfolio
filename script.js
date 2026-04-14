const navLinks = document.querySelectorAll('.nav-links li a');
const menuCheck = document.getElementById('check');

navLinks.forEach(link => {
  link.addEventListener('click', () => {
    menuCheck.checked = false;
  });
});

const form = document.getElementById('contact-form');
const status = document.getElementById('form-status');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  e.stopPropagation(); 

  const data = new FormData(form);
  const btn = document.getElementById('submit-btn');
  
  btn.innerText = "Sending...";
  btn.disabled = true;

  try {
    const response = await fetch(form.action, {
      method: 'POST',
      body: data,
      headers: { 'Accept': 'application/json' }
    });

    if (response.ok) {
      status.innerHTML = "Success! Message sent.";
      status.style.color = "#28a745";
      form.reset();
    } else {
      status.innerHTML = "Error: Please check your Formspree ID.";
      status.style.color = "#dc3545";
    }
  } catch (error) {
    status.innerHTML = "Connection error. Try again.";
    status.style.color = "#dc3545";
  } finally {
    btn.innerText = "Send Message";
    btn.disabled = false;
  }
});

window.onload = function () {

  let expiryDate = new Date(2026, 3, 19);
  let today = new Date();

  if (today > expiryDate) return;

  let popup = document.getElementById("popup");

  popup.style.display = "flex";
  document.body.classList.add("lock-scroll");

  setTimeout(() => {
    popup.classList.add("show");
  }, 50);
};

function closePopup() {
  let popup = document.getElementById("popup");

  popup.classList.remove("show");

  setTimeout(() => {
    popup.style.display = "none";
    document.body.classList.remove("lock-scroll");
  }, 400);
}