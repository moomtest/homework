'use strict';
window.renderTrophyCollection=function({totals,current,best}) {
  const $=selector=>document.querySelector(selector);
  const SUBJECTS=['漢字','算数','音読・日記'];
  const streaks={current,best};
  const titles={total:['はじめの一歩','こつこつ名人','積み重ねの達人'],streak:['連続チャレンジャー','継続名人','継続の達人']};
  $('#trophy-subjects').replaceChildren();
  SUBJECTS.forEach((subject,index)=>{
    const section=document.createElement('section');section.className='trophy-subject';
    const heading=document.createElement('h4');heading.textContent=`${index+1} ${subject}`;
    const progress=document.createElement('p');progress.className='trophy-progress';progress.textContent=`累計 ${totals[index]}回 ／ 現在の連続 ${streaks.current[index]}回 ／ 最長連続 ${streaks.best[index]}回`;
    const grid=document.createElement('ul');grid.className='trophy-grid';
    for(const kind of ['total','streak']) [10,30,50].forEach((threshold,tier)=>{
      const earned=(kind==='total'?totals[index]:streaks.best[index])>=threshold;
      const badge=document.createElement('li');badge.className=`trophy-badge ${earned?'earned':'locked'}`;badge.dataset.subject=index;badge.dataset.kind=kind;badge.dataset.threshold=threshold;
      const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');icon.setAttribute('viewBox','0 0 64 64');icon.setAttribute('aria-hidden','true');icon.classList.add('trophy-icon');
      const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d','M18 8h28v5h12v8c0 10-6 16-17 17a16 16 0 0 1-6 4v10h11v6H18v-6h11V42a16 16 0 0 1-6-4C12 37 6 31 6 21v-8h12V8zm0 11h-6v2c0 5 3 9 8 10-1-4-2-8-2-12zm28 0c0 4-1 8-2 12 5-1 8-5 8-10v-2h-6z');icon.append(path);
      const condition=document.createElement('strong');condition.className='trophy-condition';condition.textContent=`${kind==='total'?'累計':'連続'}${threshold}回`;
      const title=document.createElement('span');title.className='trophy-title';title.textContent=titles[kind][tier];
      const status=document.createElement('span');status.className='trophy-status';status.textContent=earned?'獲得！':'未達成';
      badge.append(icon,condition,title,status);grid.append(badge);
    });
    section.append(heading,progress,grid);$('#trophy-subjects').append(section);
  });
}
