export type ScheduleInput =
    | { type: 'EVERY_X_MINUTES'; minutes: number }
    | { type: 'DAILY'; time: string }
    | { type: 'WEEKLY'; time: string; day: 'SUN' | 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' }
    | { type: 'MONTHLY'; time: string; date: number }
    | { type: 'LAST_DAY_OF_MONTH'; time: string };

export function buildCronFromSchedule(input: ScheduleInput): string {
    switch (input.type) {
        // case 'EVERY_X_MINUTES': {
        //     if (!input.minutes || input.minutes < 1 || input.minutes > 59) {
        //         throw new Error('minutes must be between 1 and 59');
        //     }
        //     return `*/${input.minutes} * * * *`;
        // }

        case 'DAILY': {
            validateTime(input.time);
            const [hour, minute] = input.time.split(':');
            return `${minute} ${hour} * * *`;
        }

        case 'WEEKLY': {
            validateTime(input.time);
            const map = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };
            const [hour, minute] = input.time.split(':');
            return `${minute} ${hour} * * ${map[input.day]}`;
        }

        case 'MONTHLY': {
            validateTime(input.time);

            if (input.date < 1 || input.date > 31) {
                throw new Error('date must be between 1 and 31');
            }

            const [hour, minute] = input.time.split(':');
            return `${minute} ${hour} ${input.date} * *`;
        }

        // case 'LAST_DAY_OF_MONTH': {
        //     validateTime(input.time);
        //     const [hour, minute] = input.time.split(':');

        //     // check your cron library support
        //     return `${minute} ${hour} L * *`;
        // }

        default:
            throw new Error('Unsupported schedule');
    }
}

// Example inputs:

// {
//   "type": "EVERY_X_MINUTES",       ==> */15 * * * *
//   "minutes": 15
// }
// {
//   "type": "DAILY",     ==> 0 10 * * *
//   "time": "10:00"
// }
// {
//   "type": "WEEKLY",          ==> 0 10 * * 1
//   "day": "MON",             
//   "time": "10:00"
// }
// {
//   "type": "MONTHLY",        ==> 0 10 5 * *
//   "date": 5,    
//   "time": "10:00"
// }
// {
//   "type": "LAST_DAY_OF_MONTH",  ==> 0 22 L * *
//   "time": "22:00"
// }


function validateTime(time: string) {
    const match = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
    if (!match) throw new Error('Invalid time format. Use HH:mm');
}