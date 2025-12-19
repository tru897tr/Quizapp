window.addEventListener('DOMContentLoaded', async () => {
    const pathParts = window.location.pathname.split('/');
    const quizId = parseInt(pathParts[pathParts.length - 1]);
    
    if (isNaN(quizId)) {
        alert('ID quiz không hợp lệ');
        window.location.href = '/';
        return;
    }
    
    try {
        const response = await fetch(`/api/quiz/${quizId}`);
        const result = await response.json();
        
        if (result.success) {
            document.getElementById('quizTitle').textContent = result.quiz.title;
            document.getElementById('quizDesc').textContent = 
                `${result.quiz.questionCount} câu hỏi - Bởi ${result.quiz.author}`;
        } else {
            alert(result.error);
            window.location.href = '/';
        }
    } catch (error) {
        alert('Lỗi tải quiz');
        window.location.href = '/';
    }
});

function startQuiz() {
    const pathParts = window.location.pathname.split('/');
    const quizId = pathParts[pathParts.length - 1];
    window.location.href = `/quiz/${quizId}`;
}