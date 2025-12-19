let questions = [];
let quizId = null;

window.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('/api/verify');
        if (!response.ok) {
            window.location.href = '/login';
            return;
        }
        const result = await response.json();
        document.getElementById('userDisplay').textContent = result.user.username;
        
        const pathParts = window.location.pathname.split('/');
        quizId = parseInt(pathParts[pathParts.length - 1]);
        
        if (isNaN(quizId)) {
            alert('ID quiz không hợp lệ');
            window.location.href = '/myactivities';
            return;
        }
        
        loadQuiz();
    } catch (error) {
        window.location.href = '/login';
    }
});

async function loadQuiz() {
    try {
        const response = await fetch(`/api/quiz/${quizId}`, {
            headers: { 'X-Request-Full-Data': 'true' }
        });
        const result = await response.json();
        
        if (!result.success) {
            alert(result.error);
            window.location.href = '/myactivities';
            return;
        }
        
        if (!result.quiz.isOwner) {
            alert('Bạn không có quyền chỉnh sửa quiz này');
            window.location.href = '/myactivities';
            return;
        }
        
        document.getElementById('quizTitle').value = result.quiz.title;
        document.getElementById('publicToggle').checked = result.quiz.isPublic;
        document.getElementById('visibilityStatus').textContent = result.quiz.isPublic ? 'Công khai' : 'Riêng tư';
        
        questions = result.quiz.questions;
        renderQuestions();
    } catch (error) {
        alert('Lỗi tải quiz');
        window.location.href = '/myactivities';
    }
}

document.getElementById('publicToggle').addEventListener('change', (e) => {
    document.getElementById('visibilityStatus').textContent = e.target.checked ? 'Công khai' : 'Riêng tư';
});

function addQuestion() {
    questions.push({
        question: '',
        options: [
            { text: '', isCorrect: false },
            { text: '', isCorrect: false }
        ]
    });
    renderQuestions();
}

function deleteQuestion(index) {
    if (questions.length === 1) {
        showToast('Phải có ít nhất một câu hỏi', 'error');
        return;
    }
    if (confirm('Bạn có chắc muốn xóa câu hỏi này?')) {
        questions.splice(index, 1);
        renderQuestions();
    }
}

function addOption(questionIndex) {
    if (questions[questionIndex].options.length >= 6) {
        showToast('Tối đa 6 đáp án cho mỗi câu hỏi', 'error');
        return;
    }
    questions[questionIndex].options.push({ text: '', isCorrect: false });
    renderQuestions();
}

function deleteOption(questionIndex, optionIndex) {
    if (questions[questionIndex].options.length <= 2) {
        showToast('Phải có ít nhất 2 đáp án', 'error');
        return;
    }
    questions[questionIndex].options.splice(optionIndex, 1);
    renderQuestions();
}

function updateQuestion(index, value) {
    questions[index].question = value;
}

function updateOption(questionIndex, optionIndex, value) {
    questions[questionIndex].options[optionIndex].text = value;
}

function toggleCorrect(questionIndex, optionIndex) {
    questions[questionIndex].options.forEach((opt, idx) => {
        opt.isCorrect = idx === optionIndex;
    });
    renderQuestions();
}

function renderQuestions() {
    const container = document.getElementById('questionsContainer');
    container.innerHTML = '';
    
    questions.forEach((q, qIndex) => {
        const questionDiv = document.createElement('div');
        questionDiv.className = 'question-item';
        
        let optionsHTML = '';
        q.options.forEach((opt, oIndex) => {
            const label = String.fromCharCode(65 + oIndex);
            const canDelete = q.options.length > 2;
            optionsHTML += `
                <div class="option-item">
                    <div class="option-label-badge">${label}</div>
                    <input type="text" class="option-input" placeholder="Nhập đáp án ${label}" 
                           value="${opt.text}" 
                           oninput="updateOption(${qIndex}, ${oIndex}, this.value)">
                    <div class="correct-checkbox-wrapper">
                        <input type="checkbox" class="correct-checkbox" 
                               ${opt.isCorrect ? 'checked' : ''}
                               onchange="toggleCorrect(${qIndex}, ${oIndex})"
                               title="Đáp án đúng">
                    </div>
                    ${canDelete ? `<button class="delete-option-btn" onclick="deleteOption(${qIndex}, ${oIndex})">✕</button>` : '<div style="width:32px"></div>'}
                </div>
            `;
        });
        
        questionDiv.innerHTML = `
            <div class="question-header">
                <div class="question-number">Câu hỏi ${qIndex + 1}</div>
                <button class="delete-question-btn" onclick="deleteQuestion(${qIndex})">✕</button>
            </div>
            <div class="question-input-group">
                <textarea class="question-input" placeholder="Nhập câu hỏi của bạn..." 
                          oninput="updateQuestion(${qIndex}, this.value)">${q.question}</textarea>
            </div>
            <div class="options-list">
                ${optionsHTML}
            </div>
            <button class="add-option-btn" onclick="addOption(${qIndex})" 
                    ${q.options.length >= 6 ? 'disabled' : ''}>
                + Thêm câu trả lời ${q.options.length >= 6 ? '(Tối đa 6)' : ''}
            </button>
        `;
        
        container.appendChild(questionDiv);
    });
}

async function updateQuiz() {
    const title = document.getElementById('quizTitle').value.trim();
    const isPublic = document.getElementById('publicToggle').checked;
    
    if (!title) {
        showToast('Vui lòng nhập tiêu đề quiz', 'error');
        return;
    }
    
    for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        
        if (!q.question.trim()) {
            showToast(`Câu hỏi ${i + 1}: Vui lòng nhập nội dung`, 'error');
            return;
        }
        
        for (let j = 0; j < q.options.length; j++) {
            if (!q.options[j].text.trim()) {
                showToast(`Câu hỏi ${i + 1}: Đáp án ${String.fromCharCode(65 + j)} không được trống`, 'error');
                return;
            }
        }
        
        const correctCount = q.options.filter(o => o.isCorrect).length;
        if (correctCount !== 1) {
            showToast(`Câu hỏi ${i + 1}: Phải chọn đúng 1 đáp án đúng`, 'error');
            return;
        }
    }
    
    try {
        const response = await fetch(`/api/quiz/${quizId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, questions, isPublic })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast(result.message, 'success');
            setTimeout(() => {
                window.location.href = '/myactivities';
            }, 1500);
        } else {
            showToast(result.error, 'error');
        }
    } catch (error) {
        showToast('Lỗi kết nối', 'error');
    }
}