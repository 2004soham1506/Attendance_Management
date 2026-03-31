FROM python:3.11-slim

WORKDIR /app

COPY . .

RUN pip install --no-cache-dir -r requirements.txt
RUN pip install flask-cors
EXPOSE 4040

CMD ["python", "-m", "app.main"]