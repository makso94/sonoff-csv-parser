import fs from "fs";
import path from "path";
import csv from "csv-parser";
import { exit } from "process";
import { START_DATE, END_DATE, LOW_TARIFF_RANGES } from "./constants";
import { isWithinInterval, parse, getDay } from "date-fns";

// Get the file path from command-line arguments
const filePath = process.argv[2];

if (!filePath) {
  console.error("Missing CSV file as argument!");
  exit(1);
}

const absolutePath = path.resolve(filePath);

// Initialize consumption sums for each tariff
let lowTariffConsumption = 0;
let highTariffConsumption = 0;

// Function to check if time falls within any low tariff range
const isLowTariff = (startHour: number, endHour: number): boolean =>
  LOW_TARIFF_RANGES.some(
    ({ start, end }) =>
      (startHour >= start && startHour < end) ||
      (endHour > start && endHour <= end)
  );

// Function to process each CSV row
const processRow = (row: any): void => {
  try {
    const dateColumn = Object.keys(row)[0];
    const rowDate = parse(row[dateColumn], "yyyy/M/d", new Date());

    // Ensure date is within range
    if (!isWithinInterval(rowDate, { start: START_DATE, end: END_DATE }))
      return;

    const isSunday = getDay(rowDate) === 0; // Sunday = 0 in date-fns

    // Extract time range and convert to numbers
    const [startHour, endHour] = row["time"]
      .split("-")
      .map((time: string) => parseInt(time.split(":")[0]));

    // Check if consumption falls in the low tariff period
    const isLow = isSunday || isLowTariff(startHour, endHour);
    const consumption = parseFloat(row["consumption/KWh"]);

    if (isNaN(consumption)) return;

    // Debugging log (optional)
    // console.log(
    //   `Date: ${row[dateColumn]}, Time: ${row["time"]}, Low Tariff: ${isLow}, Sunday: ${isSunday}`
    // );

    // Add consumption to respective tariff
    if (isLow) {
      lowTariffConsumption += consumption;
    } else {
      // console.log("High Tariff Entry:", row);
      highTariffConsumption += consumption;
    }
  } catch (error) {
    console.error("Error processing row:", row, error);
  }
};

// Read and process the CSV file
fs.createReadStream(absolutePath)
  .pipe(csv())
  .on("data", processRow)
  .on("end", () => {
    console.log("Low Tariff Consumption:", lowTariffConsumption.toFixed(2));
    console.log("High Tariff Consumption:", highTariffConsumption.toFixed(2));
  })
  .on("error", (error) => {
    console.error("Error reading CSV:", error);
  });
