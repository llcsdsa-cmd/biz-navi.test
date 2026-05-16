/* ========================================================================== */
/* pro-features.js - 矢印削除・オートフォーカス強化版
/* ========================================================================== */

const ProFeature = {
    data: JSON.parse(localStorage.getItem('pro_daily_data')) || {
        lastMeter: 0,
        bizTotal: 0,
        privTotal: 0,
        isWorking: false,
        history: []
    },

    init: function() {
        this.injectFloatingButton();
        this.injectGlobalStyles(); // スピンボタン削除用のCSSを注入
    },

    saveData: function() {
        localStorage.setItem('pro_daily_data', JSON.stringify(this.data));
    },

    /**
     * 数字入力欄の上下矢印（スピンボタン）を消すためのCSS
     */
    injectGlobalStyles: function() {
        if (document.getElementById('pro-global-styles')) return;
        const style = document.createElement('style');
        style.id = 'pro-global-styles';
        style.innerHTML = `
            /* Chrome, Safari, Edge, Opera の矢印削除 */
            #pro-meter-input::-webkit-outer-spin-button,
            #pro-meter-input::-webkit-inner-spin-button {
                -webkit-appearance: none;
                margin: 0;
            }
            /* Firefox の矢印削除 */
            #pro-meter-input[type=number] {
                -moz-appearance: textfield;
            }
        `;
        document.head.appendChild(style);
    },

    injectFloatingButton: function() {
        if (document.getElementById('nav-pro-btn')) return;
        const btnHtml = `
            <div id="nav-pro-btn" 
                 style="position:fixed; bottom:25px; right:20px; width:95px; height:95px; background:#6366f1; color:white; border:none; border-radius:24px; display:flex; flex-direction:column; align-items:center; justify-content:center; box-shadow:0 12px 24px rgba(99,102,241,0.4); cursor:pointer; z-index:9999; animation: pro-float 3s ease-in-out infinite;"
                 onclick="ProFeature.openDailyForm()">
                <span style="font-size:2.5rem; line-height:1;">📝</span>
                <span style="font-size:1.1rem; font-weight:bold; margin-top:4px;">日報</span>
            </div>
            <style>
                @keyframes pro-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
            </style>
        `;
        document.body.insertAdjacentHTML('beforeend', btnHtml);
    },

    openDailyForm: function() {
        const isStart = !this.data.isWorking;
        const title = isStart ? "☀️ おはよう<br>ございます！" : "🌙 お疲れ様<br>でした！";
        const subTitle = isStart ? "【始業入力】" : "【終業入力】";
        const label = isStart ? "現在の開始メーター" : "現在の終了メーター";
        
        const hintText = isStart 
            ? `前回終了: ${this.data.lastMeter} km<br><span style="color:#6366f1; font-weight:bold;">※数値が違う場合は修正してください</span>`
            : `本日開始: ${this.data.lastMeter} km`;

        const btnText = isStart ? "業務開始 🚚" : "業務終了 ✨";

        const modalHtml = `
            <div id="pro-modal-overlay" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:10001; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(8px);">
                <div style="background:white; width:92%; max-width:420px; border-radius:32px; padding:35px; box-shadow:0 25px 50px rgba(0,0,0,0.3); box-sizing:border-box;">
                    
                    <div style="text-align:center; margin-bottom:25px;">
                        <h2 style="margin:0; font-size:2.2rem; color:#1e293b; line-height:1.2; font-weight:800;">${title}</h2>
                        <div style="color:#64748b; font-size:1.3rem; margin-top:10px; font-weight:bold;">${subTitle}</div>
                    </div>
                    
                    <div style="margin-bottom:30px; background:#f8fafc; padding:25px; border-radius:24px; border:1px solid #f1f5f9;">
                        <label style="display:block; font-size:1.2rem; color:#475569; margin-bottom:15px; font-weight:bold; text-align:center;">${label}</label>
                        
                        <input type="number" inputmode="decimal" id="pro-meter-input" value="${this.data.lastMeter}" 
                               style="width:100%; padding:20px; border:3px solid #e2e8f0; border-radius:20px; font-size:2.2rem; text-align:center; outline:none; box-sizing:border-box; color:#1e293b; font-weight:800; background:white;">
                        
                        <p style="font-size:1.1rem; color:#94a3b8; margin-top:18px; text-align:center; line-height:1.5;">
                            ${hintText}
                        </p>
                    </div>

                    <button onclick="ProFeature.handleSave()" 
                            style="width:100%; padding:22px; border:none; background:#6366f1; color:white; border-radius:22px; font-size:1.4rem; font-weight:bold; cursor:pointer; box-shadow:0 6px 20px rgba(99,102,241,0.4);">
                        ${btnText}
                    </button>
                    
                    <button onclick="document.getElementById('pro-modal-overlay').remove()" 
                            style="width:100%; margin-top:20px; padding:15px; border:none; background:none; color:#94a3b8; font-size:1.2rem; cursor:pointer; font-weight:bold;">
                        キャンセル
                    </button>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // モーダル表示直後に実行
        const input = document.getElementById('pro-meter-input');
        input.focus();
        input.select();
    },

    handleSave: function() {
        const val = parseFloat(document.getElementById('pro-meter-input').value);
        if (isNaN(val) || val < this.data.lastMeter) {
            alert("数値を正しく入力してください。\n（前回より小さい値は入力不可）");
            return;
        }

        if (!this.data.isWorking) {
            const privDist = val - this.data.lastMeter;
            this.data.privTotal += privDist;
            this.data.lastMeter = val;
            this.data.isWorking = true;
            alert(`記録しました！\n私用走行: ${privDist.toFixed(1)}km`);
        } else {
            const bizDist = val - this.data.lastMeter;
            this.data.bizTotal += bizDist;
            this.data.lastMeter = val;
            this.data.isWorking = false;
            this.data.history.push({ date: new Date().toLocaleDateString(), biz: bizDist, meter: val });
            alert(`お疲れ様でした！\n業務走行: ${bizDist.toFixed(1)}km`);
        }

        this.saveData();
        document.getElementById('pro-modal-overlay').remove();
    }
};

window.addEventListener('load', () => {
    setTimeout(() => ProFeature.init(), 1000);
});
