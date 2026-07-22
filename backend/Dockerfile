FROM python:3.12.13-slim
WORKDIR /application
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
ENTRYPOINT ["python"]
CMD ["app.py"]
EXPOSE 5000
ENV DB_PORT=5432
ENV DB_NAME=whalerunner
ENV DB_USER=whale
