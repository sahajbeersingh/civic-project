from flask import Flask, request, jsonify
import pickle

app = Flask(__name__)

with open("text_model.pkl", "rb") as f:
    model = pickle.load(f)

@app.route("/predict", methods=["POST"])
def predict():
    data = request.get_json()
    text = data.get("text", "")
    result = model.predict([text])
    return jsonify({"category": result[0]})

if __name__ == "__main__":
    app.run(port=5000)
