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
  const data = new FormData(form);
  const btn = document.getElementById('submit-btn');
  btn.innerText = "Sending...";
  btn.disabled = true;

  try {
    const response = await fetch(form.action, {
      method: form.method,
      body: data,
      headers: { 'Accept': 'application/json' }
    });

    if (response.ok) {
      status.innerHTML = "Thanks! Your message has been sent.";
      status.style.color = "green";
      form.reset();
    } else {
      status.innerHTML = "Oops! There was a problem.";
      status.style.color = "red";
    }
  } catch (error) {
    status.innerHTML = "Oops! Connection error.";
    status.style.color = "red";
  } finally {
    btn.innerText = "Send Message";
    btn.disabled = false;
  }
});