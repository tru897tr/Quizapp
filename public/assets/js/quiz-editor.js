/**
 * quiz-editor.js - Logic soan thao cau hoi/dap an dung chung cho trang Tao
 * quiz (create.js) va Sua quiz (edit.js).
 *
 * Thiet ke quan trong: moi thay doi (go chu, chon dap an dung, xoa dap
 * an...) deu THAO TAC TRUC TIEP TREN DOM thay vi ve lai (re-render) toan
 * bo danh sach. Neu ve lai toan bo danh sach moi khi go phim, o nhap lieu
 * dang go se bi MAT CON TRO/MAT FOCUS - day la mot dang loi "phan tu
 * khong tuong tac duoc" thuong gap. Cach lam nay tranh hoan toan van de do.
 */
(function (global) {
    'use strict';

    let container = null;

    function letterFor(i) { return String.fromCharCode(65 + i); }

    function relabelOptions(optionsList) {
        Array.from(optionsList.children).forEach((row, idx) => {
            row.querySelector('.option-badge').textContent = letterFor(idx);
            row.querySelector('.option-input').placeholder = 'Dap an ' + letterFor(idx);
        });
    }

    function renumberQuestions() {
        Array.from(container.children).forEach((card, idx) => {
            card.dataset.index = idx;
            card.querySelector('.question-number').textContent = 'Cau ' + (idx + 1);
        });
    }

    function selectAsCorrect(row) {
        const optionsList = row.parentElement;
        optionsList.querySelectorAll('.option-row').forEach(r => {
            r.classList.remove('is-correct');
            r.querySelector('.correct-radio-input').checked = false;
        });
        row.classList.add('is-correct');
        row.querySelector('.correct-radio-input').checked = true;
    }

    function createOptionRow(text, isCorrect) {
        const row = document.createElement('div');
        row.className = 'option-row' + (isCorrect ? ' is-correct' : '');
        row.innerHTML =
            '<span class="option-badge"></span>' +
            '<label class="correct-radio"><input type="radio" class="correct-radio-input"><span class="dot"></span></label>' +
            '<input type="text" class="form-input option-input" maxlength="500">' +
            '<button type="button" class="icon-btn delete-option-btn" aria-label="Xoa dap an"></button>';

        row.querySelector('.option-input').value = text || '';
        row.querySelector('.correct-radio-input').checked = !!isCorrect;
        row.querySelector('.delete-option-btn').innerHTML = Icon('close', 'icon-sm');

        row.querySelector('.correct-radio-input').addEventListener('change', () => selectAsCorrect(row));

        row.addEventListener('click', (e) => {
            if (e.target.closest('.delete-option-btn') || e.target.closest('.option-input') || e.target.closest('.correct-radio')) return;
            selectAsCorrect(row);
        });

        row.querySelector('.delete-option-btn').addEventListener('click', () => {
            const optionsList = row.parentElement;
            if (optionsList.children.length <= 2) {
                showToast('Moi cau hoi can it nhat 2 dap an.', 'warning');
                return;
            }
            const wasCorrect = row.classList.contains('is-correct');
            row.remove();
            relabelOptions(optionsList);
            if (wasCorrect && optionsList.firstElementChild) {
                selectAsCorrect(optionsList.firstElementChild);
            }
        });

        return row;
    }

    function createQuestionCard(questionText, options) {
        const card = document.createElement('div');
        card.className = 'question-card';
        card.innerHTML =
            '<div class="question-card-header">' +
            '<span class="question-number">Cau</span>' +
            '<button type="button" class="icon-btn danger delete-question-btn" aria-label="Xoa cau hoi"></button>' +
            '</div>' +
            '<textarea class="form-textarea question-input" maxlength="1000" placeholder="Nhap noi dung cau hoi..."></textarea>' +
            '<p class="correct-hint"></p>' +
            '<div class="options-list"></div>';

        card.querySelector('.question-input').value = questionText || '';
        card.querySelector('.delete-question-btn').innerHTML = Icon('trash', 'icon-sm');
        card.querySelector('.correct-hint').innerHTML = Icon('info', 'icon-sm') + ' Bam vao mot dap an de danh dau la dap an dung.';

        const optionsList = card.querySelector('.options-list');
        const opts = (options && options.length) ? options : [{ text: '', isCorrect: true }, { text: '', isCorrect: false }];
        opts.forEach(o => optionsList.appendChild(createOptionRow(o.text, o.isCorrect)));
        if (!opts.some(o => o.isCorrect) && optionsList.firstElementChild) {
            selectAsCorrect(optionsList.firstElementChild);
        }
        relabelOptions(optionsList);

        const addOptionBtn = document.createElement('button');
        addOptionBtn.type = 'button';
        addOptionBtn.className = 'btn btn-ghost btn-sm add-option-btn';
        addOptionBtn.innerHTML = Icon('plus', 'icon-sm') + ' Them dap an';
        addOptionBtn.addEventListener('click', () => {
            if (optionsList.children.length >= 6) {
                showToast('Toi da 6 dap an cho moi cau hoi.', 'warning');
                return;
            }
            optionsList.appendChild(createOptionRow('', false));
            relabelOptions(optionsList);
        });
        card.appendChild(addOptionBtn);

        card.querySelector('.delete-question-btn').addEventListener('click', () => {
            if (container.children.length <= 1) {
                showToast('Quiz can it nhat 1 cau hoi.', 'warning');
                return;
            }
            card.remove();
            renumberQuestions();
        });

        return card;
    }

    function init(containerEl) {
        container = containerEl;
    }

    function addQuestion(questionText, options) {
        container.appendChild(createQuestionCard(questionText, options));
        renumberQuestions();
        return container.lastElementChild;
    }

    function loadQuestions(questions) {
        container.innerHTML = '';
        if (!questions || !questions.length) {
            addQuestion('', null);
            return;
        }
        questions.forEach(q => container.appendChild(createQuestionCard(q.question, q.options)));
        renumberQuestions();
    }

    function getQuestions() {
        return Array.from(container.children).map(card => ({
            question: card.querySelector('.question-input').value.trim(),
            options: Array.from(card.querySelectorAll('.option-row')).map(row => ({
                text: row.querySelector('.option-input').value.trim(),
                isCorrect: row.classList.contains('is-correct')
            }))
        }));
    }

    function validate(title) {
        if (!title || !title.trim()) return 'Vui long nhap tieu de quiz.';
        const questions = getQuestions();
        if (questions.length === 0) return 'Vui long them it nhat mot cau hoi.';
        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            if (!q.question) return `Cau hoi ${i + 1}: vui long nhap noi dung cau hoi.`;
            if (q.options.some(o => !o.text)) return `Cau hoi ${i + 1}: khong duoc de trong dap an.`;
            if (!q.options.some(o => o.isCorrect)) return `Cau hoi ${i + 1}: chua chon dap an dung.`;
        }
        return null;
    }

    global.QuizEditor = { init, addQuestion, loadQuestions, getQuestions, validate };
})(window);
