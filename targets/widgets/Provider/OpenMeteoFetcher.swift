// ---------------------------------------------------------------------------
// OpenMeteoFetcher.swift — bounded, keyless direct fallback fetch.
//
// COUNTERPART: `fetchWeather` in src/data/weatherApi.ts (endpoint/fields/WMO
// mapping). Ported MINIMALLY: current + next 6 hourly + today hi/lo only — the
// widget never needs 10 days. Keyless Open-Meteo `forecast` endpoint; no auth,
// no secret management (PRD 03 US-004 / Technical Considerations).
//
// Used only when the provider's staleness gate trips (missing/stale snapshot)
// AND coordinates are resolvable from the enriched index / snapshot.city.
// Constraints (extension jetsam budget ~30MB):
//  • A SINGLE bounded URLSession request.
//  • `timeoutIntervalForRequest` 8–10s so the completion ALWAYS fires — on a
//    dead network the request times out and the closure resolves to nil, which
//    the provider deterministically falls back from (never blank, never crash).
//  • The completion is nested inside getTimeline before completion(timeline).
// ---------------------------------------------------------------------------

import Foundation

enum OpenMeteoFetcher {

    /// 9s request timeout (within the 8–10s budget). Guarantees the closure
    /// completes even when the network is dead.
    private static let requestTimeout: TimeInterval = 9

    /// Fetch a trimmed forecast and synthesize a `WidgetSnapshot`. Calls
    /// `completion(nil)` on any network/decoding failure — the provider then
    /// falls back to the last snapshot or the placeholder. NEVER throws.
    static func fetch(
        lat: Double,
        lon: Double,
        completion: @escaping (WidgetSnapshot?) -> Void
    ) {
        guard let url = forecastURL(lat: lat, lon: lon) else {
            completion(nil)
            return
        }

        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = requestTimeout
        config.timeoutIntervalForResource = requestTimeout
        config.waitsForConnectivity = false
        let session = URLSession(configuration: config)

        let task = session.dataTask(with: url) { data, response, error in
            guard
                error == nil,
                let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode),
                let data = data,
                let raw = try? JSONDecoder().decode(ForecastResponse.self, from: data),
                let snapshot = buildSnapshot(from: raw, lat: lat, lon: lon)
            else {
                completion(nil)
                return
            }
            completion(snapshot)
        }
        task.resume()
    }

    // MARK: - URL (same endpoint/fields shape as weatherApi.ts, trimmed)

    private static func forecastURL(lat: Double, lon: Double) -> URL? {
        // Minimal payload: current + next-6 hourly + today hi/lo. timezone=auto
        // so hourly index 0 is local midnight, matching the TS source.
        var comps = URLComponents(string: "https://api.open-meteo.com/v1/forecast")
        comps?.queryItems = [
            URLQueryItem(name: "latitude", value: String(lat)),
            URLQueryItem(name: "longitude", value: String(lon)),
            URLQueryItem(
                name: "current",
                value: "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,is_day"
            ),
            URLQueryItem(
                name: "hourly",
                value: "temperature_2m,precipitation_probability,weather_code,is_day"
            ),
            URLQueryItem(
                name: "daily",
                value: "temperature_2m_max,temperature_2m_min"
            ),
            URLQueryItem(name: "forecast_days", value: "2"),
            URLQueryItem(name: "timezone", value: "auto"),
        ]
        return comps?.url
    }

    // MARK: - Decode shape (only the fields we read)

    private struct ForecastResponse: Decodable {
        let utcOffsetSeconds: Int?
        let current: Current
        let hourly: Hourly
        let daily: Daily

        enum CodingKeys: String, CodingKey {
            case utcOffsetSeconds = "utc_offset_seconds"
            case current, hourly, daily
        }

        struct Current: Decodable {
            let time: String
            let temperature2m: Double
            let apparentTemperature: Double?
            let relativeHumidity2m: Double?
            let precipitation: Double?
            let weatherCode: Int
            let windSpeed10m: Double?
            let isDay: Int

            enum CodingKeys: String, CodingKey {
                case time
                case temperature2m = "temperature_2m"
                case apparentTemperature = "apparent_temperature"
                case relativeHumidity2m = "relative_humidity_2m"
                case precipitation
                case weatherCode = "weather_code"
                case windSpeed10m = "wind_speed_10m"
                case isDay = "is_day"
            }
        }

        struct Hourly: Decodable {
            let time: [String]
            let temperature2m: [Double]
            let precipitationProbability: [Double?]
            let weatherCode: [Int]
            let isDay: [Int]

            enum CodingKeys: String, CodingKey {
                case time
                case temperature2m = "temperature_2m"
                case precipitationProbability = "precipitation_probability"
                case weatherCode = "weather_code"
                case isDay = "is_day"
            }
        }

        struct Daily: Decodable {
            let temperature2mMax: [Double]
            let temperature2mMin: [Double]

            enum CodingKeys: String, CodingKey {
                case temperature2mMax = "temperature_2m_max"
                case temperature2mMin = "temperature_2m_min"
            }
        }
    }

    // MARK: - Response → WidgetSnapshot

    /// Build a schemaVersion-1 snapshot from the trimmed response. Mirrors the
    /// current-hour index + projection logic in buildScenario (weatherApi.ts),
    /// reduced to what the widget consumes. Returns nil on malformed arrays.
    private static func buildSnapshot(
        from raw: ForecastResponse,
        lat: Double,
        lon: Double
    ) -> WidgetSnapshot? {
        let cur = raw.current
        let hourly = raw.hourly
        guard !hourly.time.isEmpty, hourly.time.count == hourly.weatherCode.count else { return nil }

        let now = Date()
        let generatedAt = now.timeIntervalSince1970 * 1000
        let tzOffsetMinutes = (raw.utcOffsetSeconds ?? 0) / 60

        // Current-hour index: match the hourly slot whose date-hour prefix
        // matches current.time (timezone=auto → index 0 is local midnight).
        let nowPrefix = String(cur.time.prefix(13))
        var nowHour = hourly.time.firstIndex { String($0.prefix(13)) == nowPrefix } ?? 0
        nowHour = max(0, min(nowHour, hourly.time.count - 1))

        let isDayNow = cur.isDay == 1
        let (curCond, curLabel) = wmoInfo(code: cur.weatherCode, isDay: isDayNow)

        // today hi/lo
        let hiRaw = raw.daily.temperature2mMax.first ?? cur.temperature2m
        let loRaw = raw.daily.temperature2mMin.first ?? cur.temperature2m
        let hi = Int((max(hiRaw, loRaw)).rounded())
        let lo = Int((min(hiRaw, loRaw)).rounded())

        let temp = Int(cur.temperature2m.rounded())
        let feels = Int((cur.apparentTemperature ?? cur.temperature2m).rounded())
        let humidity = Int((cur.relativeHumidity2m ?? 0).rounded())
        let wind = Int((cur.windSpeed10m ?? 0).rounded())
        let precipProb = Int((hourly.precipitationProbability[safe: nowHour].flatMap { $0 } ?? 0).rounded())

        // Next 6 hourly from the current hour. ts = epoch ms of the local hour.
        var points: [WidgetSnapshot.HourlyPoint] = []
        for i in 0..<6 {
            let idx = nowHour + i
            guard idx < hourly.time.count else { break }
            let hIsDay = hourly.isDay[safe: idx] == 1
            let (cond, _) = wmoInfo(code: hourly.weatherCode[idx], isDay: hIsDay)
            let ts = epochMs(forLocalISO: hourly.time[idx], tzOffsetMinutes: tzOffsetMinutes)
            points.append(
                WidgetSnapshot.HourlyPoint(
                    h: i == 0 ? "Now" : hourLabel(fromISO: hourly.time[idx]),
                    cond: cond,
                    temp: Int(hourly.temperature2m[idx].rounded()),
                    pop: Int((hourly.precipitationProbability[safe: idx].flatMap { $0 } ?? 0).rounded()),
                    ts: ts
                )
            )
        }
        guard points.count >= 1 else { return nil }

        let current = WidgetSnapshot.CurrentConditions(
            temp: temp,
            feels: feels,
            hi: hi,
            lo: lo,
            cond: curCond,
            label: curLabel,
            isNight: !isDayNow,
            humidity: humidity,
            wind: wind,
            precipProb: precipProb,
            uv: 0,
            aqi: nil,
            aqiWord: nil
        )

        // Single day forecast (today) from the trimmed payload.
        let days: [WidgetSnapshot.DayForecast] = [
            WidgetSnapshot.DayForecast(label: "Today", cond: curCond, lo: lo, hi: hi, pop: precipProb)
        ]

        return WidgetSnapshot(
            schemaVersion: 1,
            generatedAt: generatedAt,
            tzOffsetMinutes: tzOffsetMinutes,
            unit: storedUnit(),
            staleAt: nil,
            city: WidgetSnapshot.CityRef(
                id: cityIdString(lat: lat, lon: lon),
                name: storedCityName(lat: lat, lon: lon) ?? "Current Location",
                lat: lat,
                lon: lon,
                admin1: nil,
                country: nil,
                isCurrentLocation: nil
            ),
            current: current,
            headline: WidgetSnapshot.HeadlineParts(pre: "", em: curLabel, post: ""),
            summary: curLabel,
            sun: WidgetSnapshot.SunInfo(
                sunrise: "",
                sunset: "",
                srHour: 0,
                ssHour: 0,
                sunPct: isDayNow ? 0.5 : 0,
                isNight: !isDayNow
            ),
            hourly: points,
            days: days
        )
    }

    // MARK: - Helpers

    /// Convert a city-local ISO hour ("2026-06-13T15:00") + tz offset to epoch ms.
    private static func epochMs(forLocalISO iso: String, tzOffsetMinutes: Int) -> Double {
        // The ISO string is wall-clock in the city's timezone. Parse as if UTC,
        // then subtract the offset to recover the true UTC instant.
        var fmt = DateComponents()
        let datePart = iso.prefix(while: { $0 != "T" })
        let timePart = iso.dropFirst(datePart.count + 1)
        let dateBits = datePart.split(separator: "-").compactMap { Int($0) }
        let timeBits = timePart.split(separator: ":").compactMap { Int($0) }
        guard dateBits.count >= 3, timeBits.count >= 2 else {
            return Date().timeIntervalSince1970 * 1000
        }
        fmt.year = dateBits[0]; fmt.month = dateBits[1]; fmt.day = dateBits[2]
        fmt.hour = timeBits[0]; fmt.minute = timeBits[1]
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC")!
        guard let wallAsUTC = cal.date(from: fmt) else {
            return Date().timeIntervalSince1970 * 1000
        }
        let trueUTC = wallAsUTC.timeIntervalSince1970 - Double(tzOffsetMinutes) * 60
        return trueUTC * 1000
    }

    /// "2026-06-13T15:00" → "3PM" (mirrors hourLabel in weatherApi.ts).
    private static func hourLabel(fromISO iso: String) -> String {
        let timePart = iso.contains("T") ? String(iso.split(separator: "T").last ?? "") : iso
        let h = Int(timePart.split(separator: ":").first ?? "0") ?? 0
        let hh = ((h % 24) + 24) % 24
        if hh == 0 { return "12AM" }
        if hh == 12 { return "12PM" }
        return hh < 12 ? "\(hh)AM" : "\(hh - 12)PM"
    }

    /// Mirror `cityId(lat, lon)` from weatherData.ts: 3-decimal lat,lon.
    private static func cityIdString(lat: Double, lon: Double) -> String {
        String(format: "%.3f,%.3f", lat, lon)
    }

    // Shared-container reads so the fetched snapshot honours the user's unit /
    // city name when available. Best-effort; defaults are safe.
    private static let suiteName = "group.com.myweatherai.app"
    private static var defaults: UserDefaults? { UserDefaults(suiteName: suiteName) }

    private static func storedUnit() -> String {
        let u = defaults?.string(forKey: "wxai.widget.unit")
        return (u == "F") ? "F" : "C"
    }

    private struct IndexEntry: Decodable { let id, name: String; let lat, lon: Double }

    private static func storedCityName(lat: Double, lon: Double) -> String? {
        guard
            let raw = defaults?.string(forKey: "wxai.widget.index"),
            let data = raw.data(using: .utf8),
            let entries = try? JSONDecoder().decode([IndexEntry].self, from: data)
        else { return nil }
        return entries.first { abs($0.lat - lat) < 0.01 && abs($0.lon - lon) < 0.01 }?.name
    }
}

// Safe array subscript so a short Open-Meteo array can never trap the extension.
private extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
