#!/usr/bin/env python
import csv
import json
import sys

def csv_to_json(input_csv):
    # Read CSV from stdin and convert to list of dictionaries
    csv_reader = csv.DictReader(input_csv)
    data = list(csv_reader)

    # Write JSON to stdout
    json.dump(data, sys.stdout, indent=2, ensure_ascii=False)

if __name__ == "__main__":
    # Convert CSV from stdin to JSON and write to stdout
    csv_to_json(sys.stdin)

