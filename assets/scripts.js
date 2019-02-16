const refresh = 15;

if (navigator.serviceWorker) {
    navigator.serviceWorker.register('/service-worker.js').then(function(){
        console.debug('SW: Register');
    }).catch(console.log);
}

function init(keys) {
    let append = '';
    for (let i = 0; i < keys.length; i++) {
        append += '<tr id="monitor-' + keys[i].id + '">' +
            '<th class="align-middle text-nowrap"><span class="status"></span> ' + keys[i].name + '</th>' +
            '<td class="align-middle latest">' +
            '<span class="reason">loading...</span>' +
            '<span class="time">loading...</span>' +
            '<span class="duration">loading...</span></td>'
        ;

        for (let r = 0; r < 9; r++) {
            append += '<td class="r-' + r + '"><span class="r' + r + ' ratio-color-loading">loading...</span></td>';
        }

        append += '</tr>';
    }

    $('table').append(append);

    loadData();
    checkStatus();
}

let apiKeys = null;
$.ajax({
    async: true,
    url: '/config/api-keys.json',
    dataType: 'json',
    success: function (data) {
        apiKeys = data;
        init(apiKeys);
    }
});

function formatDatetime(timestamp) {
    let date = new Date(timestamp * 1000);
    let options = {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    };
    return new Intl.DateTimeFormat('en-GB', options).format(date);
}

function formatDuration(duration) {
    if (duration < 60) {
        return duration + ' sec';
    }

    if (duration < 60 * 60) {
        return Math.floor(duration / 60) + ' min, ' + duration % 60 + ' sec';
    }

    return Math.floor(duration / 60 / 60) + ' hour, ' +
        Math.floor((duration / 60) % 60) + ' min, ' +
        duration % 60 + ' sec';
}

function loadData() {
    let now = new Date();

    let last24h = (Math.floor(now.getTime() / 1000) - 60 * 60 * 24) + '_' + Math.floor(now.getTime() / 1000);
    let last30d = (Math.floor(now.getTime() / 1000) - 60 * 60 * 24 * 30) + '_' + Math.floor(now.getTime() / 1000);

    let ranges = last24h + '-' + last30d;

    let day = now;
    day.setHours(0, 0, 0, 0);
    let range = [];
    for (let i = 0; i < 7; i++) {
        $('.d-' + i).html(day.getDate() + '/' + (day.getMonth() + 1));
        range[0] = Math.floor(day.getTime() / 1000);
        range[1] = Math.floor(day.setDate(day.getDate() - 1) / 1000);
        ranges += '-' + range[1] + '_' + range[0];
    }

    for (let m = 0; m < apiKeys.length; m++) {
        $.ajax({
            type: 'post',
            url: 'https://api.uptimerobot.com/v2/getMonitors',
            data: {
                api_key: apiKeys[m].key,
                custom_uptime_ranges: ranges,
                logs: 1,
                logs_limit: 1
            },
            async: true,
            success: function (data) {
                let monitor = data.monitors[0];
                let id = '#monitor-' + monitor.id;
                let ratio = monitor.custom_uptime_ranges.split('-');

                $(id + ' .status')
                    .removeAttr('class')
                    .addClass('status')
                    .addClass('status-' + monitor.status)
                ;

                if (monitor.logs.length === 0) {
                    $(id + ' .latest .time').html('');
                    $(id + ' .latest .reason').html('');
                    $(id + ' .latest .duration').html('');
                }

                let log = monitor.logs[0];
                $(id + ' .latest .time').html(formatDatetime(log.datetime));
                $(id + ' .latest .reason').html(log.reason.code + ' - ' + log.reason.detail);
                $(id + ' .latest .duration').html(formatDuration(log.duration));

                let color = 'inherit';
                switch (monitor.status) {
                    case 0:
                        color = 'var(--monitor-paused)';
                        break;
                    case 1:
                        color = 'var(--monitor-not-checked-yet)';
                        break;
                    case 2:
                        color = 'var(--monitor-up)';
                        break;
                    case 8:
                        color = 'var(--monitor-seems-offline)';
                        break;
                    case 9:
                        color = 'var(--monitor-down)';
                        break;
                }

                $(id + ' .latest .reason').css('color', color);

                for (let i = 0; i < ratio.length; i++) {
                    let content = (ratio[i] === '100.000' ? 100 : ratio[i]) + '%';
                    let $el = $(id + ' .r' + i);
                    if (content !== $el.html()) {
                        $el
                            .removeAttr('class')
                            .addClass('r' + i)
                            .addClass('ratio-color-' + ratio[i].split('.')[0])
                            .html(content)
                            .hide()
                            .slideDown()
                        ;
                    }
                }

                $('.last-update').html(formatDatetime((new Date()).getTime() / 1000));
            }
        });
    }
}

function checkStatus() {
    let up = $('.status-2').length;
    let down = $('.status-9').length;
    let paused = $('.status-0').length;
    let unknown = $('.status').length - up - down - paused;

    $('.monitors-up').html(up);
    $('.monitors-down').html(down);
    $('.monitors-paused').html(paused);
    $('.monitors-unknown').html(unknown);

    if (down > 0) {
        $('header').css('background', 'var(--monitor-down)');
        $('#summary.fixed').css('border-top-color', 'var(--monitor-down)');
        $('link[rel="icon"]').attr('href', '/assets/img/favicons/favicon-down.ico');
        $('meta[name="theme-color"]').attr('content', '#D32F2F');
    } else if (up > 0) {
        $('header').css('background', 'var(--monitor-up)');
        $('#summary.fixed').css('border-top-color', 'var(--monitor-up)');
        $('link[rel="icon"]').attr('href', '/assets/img/favicons/favicon-up.ico');
        $('meta[name="theme-color"]').attr('content', '#8BC34A');
    } else {
        $('header').css('background', 'var(--monitor-not-checked-yet)');
        $('#summary.fixed').css('border-top-color', 'var(--monitor-not-checked-yet)');
        $('link[rel="icon"]').attr('href', '/assets/img/favicons/favicon-not-checked-yet.ico');
        $('meta[name="theme-color"]').attr('content', '#E0E0E0');
    }
}

$(document).on('scroll', function () {
    let $div = $('#summary');
    let pos = $('header').height();
    if (pos < window.scrollY) {
        $div.addClass('fixed');
        $('body').css('padding-top', $div.height());
    } else {
        $('body').css('padding-top', 0);
        $div.removeClass('fixed');
    }
});

let timeout = refresh;
setInterval(function () {
    checkStatus();
    if (--timeout === 0) {
        loadData();
        $('.countdown').html(timeout);
        timeout = refresh;
    } else {
        $('.countdown').html(timeout);
    }
}, 1000);
