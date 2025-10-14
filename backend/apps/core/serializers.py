from rest_framework import serializers
from django.contrib.auth import authenticate

# from django.contrib.gis.geos import GEOSGeometry  # Commented out for
# development
from .models import User, AnalysisProject, GeometryInput, FileUpload


class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = (
            "email",
            "username",
            "password",
            "password_confirm",
            "earth_engine_project_id",
        )
        extra_kwargs = {
            'username': {'required': False}  # Make username optional
        }

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError("Passwords don't match")
        return attrs

    def create(self, validated_data):
        validated_data.pop("password_confirm")
        
        # Auto-generate username from email if not provided
        if not validated_data.get('username'):
            email = validated_data['email']
            base_username = email.split('@')[0]
            username = base_username
            counter = 1
            
            # Ensure username is unique
            while User.objects.filter(username=username).exists():
                username = f"{base_username}{counter}"
                counter += 1
            
            validated_data['username'] = username
        
        user = User.objects.create_user(**validated_data)
        return user


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "username",
            "earth_engine_project_id",
            "is_earth_engine_authenticated",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "created_at",
            "updated_at",
            "is_earth_engine_authenticated",
        )


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField()

    def validate(self, attrs):
        email = attrs.get("email")
        password = attrs.get("password")

        if email and password:
            user = authenticate(username=email, password=password)
            if not user:
                raise serializers.ValidationError("Invalid credentials")
            if not user.is_active:
                raise serializers.ValidationError("User account is disabled")
            attrs["user"] = user
            return attrs
        else:
            raise serializers.ValidationError("Email and password are required")


class AnalysisProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnalysisProject
        fields = ("id", "name", "description", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")

    def validate_name(self, value):
        """Ensure project name is unique for the current user"""
        user = self.context['request'].user
        # Check if a project with this name already exists for this user
        if AnalysisProject.objects.filter(name__iexact=value, user=user).exists():
            raise serializers.ValidationError(
                f"A project with the name '{value}' already exists. Please choose a different name."
            )
        return value

    def create(self, validated_data):
        validated_data["user"] = self.context["request"].user
        return super().create(validated_data)


class GeometryInputSerializer(serializers.ModelSerializer):
    geometry = serializers.CharField()

    class Meta:
        model = GeometryInput
        fields = ("id", "name", "geometry", "created_at")
        read_only_fields = ("id", "created_at")

    def validate_geometry(self, value):
        # For development without GDAL, just validate it's valid JSON
        if isinstance(value, str):
            try:
                import json

                json.loads(value)
                return value
            except json.JSONDecodeError:
                raise serializers.ValidationError("Invalid JSON geometry")
        return value

    def create(self, validated_data):
        validated_data["user"] = self.context["request"].user
        project_id = self.context["request"].data.get("project_id")
        if project_id:
            try:
                project = AnalysisProject.objects.get(
                    id=project_id, user=self.context["request"].user
                )
                validated_data["project"] = project
            except AnalysisProject.DoesNotExist:
                pass
        return super().create(validated_data)


class FileUploadSerializer(serializers.ModelSerializer):
    class Meta:
        model = FileUpload
        fields = ("id", "name", "file", "upload_type", "processed", "created_at")
        read_only_fields = ("id", "processed", "created_at")

    def create(self, validated_data):
        validated_data["user"] = self.context["request"].user
        return super().create(validated_data)
