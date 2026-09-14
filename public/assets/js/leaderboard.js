(function () {
    'use strict';

    function getQuizIdFromUrl() {
        const parts = window.location.pathname.split('/').filter(Boolean);
        return parts[1];
    }

    function renderRankRow(entry) {
        const row = document.createElement('div');
        row.className = 'rank-row' + (entry.rank <= 3 ? ` rank-${entry.rank}` : '');
        row.innerHTML = `
            <div class="rank-number">${entry.rank}</div>
            <div class="rank-name"></div>
            <div class="rank-time">${Utils.formatDuration(entry.totalTime)}</div>
        `;
        row.querySelector('.rank-name').textContent = entry.username;
        return row;
    }

    async function init() {
        const quizId = getQuizIdFromUrl();
        await Nav.initAuthState();

        const { ok, data } = await apiGet(`/api/quiz/${quizId}/leaderboard`);
        document.getElementById('loadingState').style.display = 'none';

        if (!ok) {
            document.getElementById('notFoundState').style.display = 'block';
            return;
        }

        document.getElementById('quizTitle').textContent = data.quizTitle;
        document.getElementById('content').style.display = 'block';

        if (data.yourBest) {
            const card = document.getElementById('yourBestCard');
            card.style.display = 'flex';
            document.getElementById('yourBestValue').textContent = Utils.formatDuration(data.yourBest.totalTime);
            document.getElementById('yourBestRank').textContent = '#' + data.yourBest.rank;
        }

        const list = document.getElementById('rankingList');
        if (!data.ranking || data.ranking.length === 0) {
            document.getElementById('emptyRanking').style.display = 'block';
            return;
        }
        data.ranking.forEach(entry => list.appendChild(renderRankRow(entry)));
    }

    document.addEventListener('DOMContentLoaded', init);
})();
