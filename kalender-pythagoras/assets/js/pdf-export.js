async function exportToPDF() {
    const button = document.querySelector('.export-pdf-btn');
    const originalText = button.innerHTML;
    button.innerHTML = '⏳ Generating PDF...';
    button.disabled = true;

    try {
        const element = document.getElementById('proofContent');
        
        const canvas = await html2canvas(element, {
            scale: 2,
            useCORS: true,
            logging: false,
            windowWidth: 1200
        });

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        
        const imgWidth = 210;
        const pageHeight = 297;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(canvas, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        while (heightLeft >= 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(canvas, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
        }

        const pageCount = pdf.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            pdf.setPage(i);
            pdf.setFontSize(10);
            pdf.setTextColor(100);
            pdf.text(
                'Kalender Pythagoras 2027 - Projek SMP Kelas 8',
                imgWidth / 2,
                pageHeight - 10,
                { align: 'center' }
            );
            pdf.text(
                `Halaman ${i} dari ${pageCount}`,
                imgWidth - 10,
                pageHeight - 10,
                { align: 'right' }
            );
        }

        const proofTitle = document.querySelector('.proof-info h1').textContent;
        pdf.save(`${proofTitle.replace(/[^a-z0-9]/gi, '_')}.pdf`);

    } catch (error) {
        console.error('Error generating PDF:', error);
        alert('Gagal membuat PDF. Silakan coba lagi.');
    } finally {
        button.innerHTML = originalText;
        button.disabled = false;
    }
}
