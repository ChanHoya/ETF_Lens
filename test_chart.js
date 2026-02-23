const generate1D = (lastDailyPoint, keys) => {
    let points = [];
    let currentTime = new Date("2023-10-10T09:00:00");
    const endTime = new Date("2023-10-10T15:30:00");
    let state = {};
    keys.forEach(k => {
        state[k] = lastDailyPoint[`${k}_raw`] || 10000;
        state[`${k}_base`] = state[k];
    });

    while (currentTime <= endTime) {
        let timeStr = currentTime.toLocaleTimeString('en-US', {hour12: false, hour: '2-digit', minute:'2-digit'});
        let pt = { date: timeStr };
        keys.forEach(k => {
            state[k] = state[k] * (1 + (Math.random() - 0.5) * 0.002);
            pt[`${k}_raw`] = Number(state[k].toFixed(0));
            pt[k] = Number(((state[k] / state[`${k}_base`]) * 100).toFixed(2));
        });
        points.push(pt);
        currentTime.setMinutes(currentTime.getMinutes() + 5);
    }
    return points;
}
console.log(generate1D({'A_raw': 10000}, ['A']).slice(0, 3));
