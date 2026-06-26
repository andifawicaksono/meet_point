// Dynamic imports keep html2canvas + jsPDF out of the initial bundle
// until the user actually clicks export.

function showToast(message, type = 'info') {
  const existing = document.getElementById('__mp_export_toast');
  if (existing) existing.remove();

  const colors = {
    info:    'bg-gray-700',
    success: 'bg-green-600',
    error:   'bg-red-600',
  };

  const el = document.createElement('div');
  el.id = '__mp_export_toast';
  el.className = [
    'fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999]',
    'px-5 py-3 rounded-xl shadow-xl text-white text-sm font-medium',
    'transition-all duration-300',
    colors[type] ?? colors.info,
  ].join(' ');
  el.textContent = message;

  document.body.appendChild(el);
  setTimeout(() => el?.remove(), 3500);
}

function buildFilename(roomName, ext) {
  const safe = (roomName ?? 'room').replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_').toLowerCase();
  const date = new Date().toISOString().split('T')[0];
  return `meetpoint_${safe}_${date}.${ext}`;
}

function triggerDownload(dataUrl, filename) {
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

// ── PNG ────────────────────────────────────────────────────────────────────

export async function exportToPNG(elementId, roomName) {
  const element = document.getElementById(elementId);
  if (!element) {
    alert('Elemen whiteboard tidak ditemukan. Pastikan whiteboard sudah terbuka.');
    return;
  }

  showToast('Menyiapkan gambar PNG…', 'info');

  try {
    const { default: html2canvas } = await import('html2canvas');
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          showToast('Gagal membuat gambar.', 'error');
          return;
        }
        const url = URL.createObjectURL(blob);
        triggerDownload(url, buildFilename(roomName, 'png'));
        URL.revokeObjectURL(url);
        showToast('PNG berhasil diunduh!', 'success');
      },
      'image/png',
    );
  } catch (err) {
    console.error('[Export] PNG failed:', err);
    alert('Gagal mengekspor PNG. Periksa konsol untuk detail.');
  }
}

// ── JPG ────────────────────────────────────────────────────────────────────

export async function exportToJPG(elementId, roomName) {
  const element = document.getElementById(elementId);
  if (!element) {
    alert('Elemen whiteboard tidak ditemukan.');
    return;
  }

  showToast('Menyiapkan gambar JPG…', 'info');

  try {
    const { default: html2canvas } = await import('html2canvas');
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff', // JPG has no transparency — fill with white
      logging: false,
    });

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          showToast('Gagal membuat gambar.', 'error');
          return;
        }
        const url = URL.createObjectURL(blob);
        triggerDownload(url, buildFilename(roomName, 'jpg'));
        URL.revokeObjectURL(url);
        showToast('JPG berhasil diunduh!', 'success');
      },
      'image/jpeg',
      0.95,
    );
  } catch (err) {
    console.error('[Export] JPG failed:', err);
    alert('Gagal mengekspor JPG. Periksa konsol untuk detail.');
  }
}

// ── PDF ────────────────────────────────────────────────────────────────────

const A4_W_MM  = 297; // landscape
const A4_H_MM  = 210;
const HEADER_H = 12;  // mm reserved for header text

export async function exportToPDF(elementId, roomName) {
  const element = document.getElementById(elementId);
  if (!element) {
    alert('Elemen whiteboard tidak ditemukan.');
    return;
  }

  showToast('Membuat PDF…', 'info');

  try {
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import('html2canvas'),
      import('jspdf'),
    ]);

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    // ── Header ──────────────────────────────────────────────────────────
    pdf.setFontSize(10);
    pdf.setTextColor(80, 80, 80);
    pdf.text(`MeetPoint — ${roomName ?? 'Room'}`, 10, 8);
    pdf.text(
      new Date().toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' }),
      A4_W_MM - 10,
      8,
      { align: 'right' },
    );

    // Thin divider line below header
    pdf.setDrawColor(220, 220, 220);
    pdf.setLineWidth(0.3);
    pdf.line(10, HEADER_H - 1, A4_W_MM - 10, HEADER_H - 1);

    // ── Fit canvas to A4 content area (maintain aspect ratio) ───────────
    const contentH = A4_H_MM - HEADER_H;
    const canvasAspect = canvas.width / canvas.height;
    const pageAspect   = A4_W_MM / contentH;

    let imgW, imgH;
    if (canvasAspect > pageAspect) {
      imgW = A4_W_MM;
      imgH = A4_W_MM / canvasAspect;
    } else {
      imgH = contentH;
      imgW = contentH * canvasAspect;
    }

    const offsetX = (A4_W_MM - imgW) / 2;
    const offsetY = HEADER_H + (contentH - imgH) / 2;

    pdf.addImage(
      canvas.toDataURL('image/jpeg', 0.92),
      'JPEG',
      offsetX,
      offsetY,
      imgW,
      imgH,
    );

    pdf.save(buildFilename(roomName, 'pdf'));
    showToast('PDF berhasil diunduh!', 'success');
  } catch (err) {
    console.error('[Export] PDF failed:', err);
    alert('Gagal mengekspor PDF. Periksa konsol untuk detail.');
  }
}
