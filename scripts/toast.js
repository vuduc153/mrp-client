TOAST_DELAY = 3000;

function showToast(toastId) {
    const toast = document.getElementById(toastId);
    const dismissBtn = toast.querySelector('button');
    toast.classList.remove("hidden");
    toast.classList.remove("opacity-0");
    setTimeout(() => dismissBtn.click(), TOAST_DELAY);
}